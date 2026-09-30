<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Domain\Platform\Settings;
use App\Domain\Shared\ApiException;
use App\Models\Employee;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LeadAssignmentService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Settings $settings,
    ) {}

    /**
     * Employees the actor may assign leads to: everyone eligible for view_all holders, own team for team leaders.
     *
     * @return Collection<int, Employee>
     */
    public function assignableEmployees(User $actor): Collection
    {
        $query = self::eligibleEmployees();

        if (! $actor->can('leads.view_all')) {
            $teamId = $actor->employee?->team_id;
            $teamId === null ? $query->whereRaw('1 = 0') : $query->where('team_id', $teamId);
        }

        return $query->with('user:id,name')->get();
    }

    public function assign(User $actor, Lead $lead, ?Employee $to, string $reason, string $method = 'manual'): Lead
    {
        if (! $actor->can('leads.assign')) {
            throw ApiException::forbidden();
        }

        if (! Lead::query()->visibleTo($actor)->whereKey($lead->id)->exists()) {
            throw ApiException::forbidden('This lead is outside your scope.');
        }

        if ($to !== null && ! $this->assignableEmployees($actor)->contains('id', $to->id)) {
            throw ApiException::forbidden('You cannot assign leads to this employee.', 'ASSIGNEE_OUT_OF_SCOPE');
        }

        return $this->applyAssignment($lead, $to, $actor, $reason, $method);
    }

    /**
     * A staff member who creates a lead owns it (no leads.assign permission needed).
     */
    public function assignToSelf(User $actor, Lead $lead): Lead
    {
        $employee = $actor->employee ?? throw ApiException::forbidden('Only employees can own leads.');

        if ($lead->assigned_employee_id !== null) {
            throw ApiException::forbidden('This lead already has an owner.', 'LEAD_ALREADY_ASSIGNED');
        }

        return $this->applyAssignment($lead, $employee, $actor, 'Created by this employee', 'manual');
    }

    /**
     * Round-robin by workload: the eligible employee with the fewest open leads, oldest last assignment first.
     * Duplicates follow the original lead's owner so one person handles the same prospect.
     */
    public function autoAssign(Lead $lead): ?Lead
    {
        if (! $this->settings->get('crm.auto_assign_enabled', false) || $lead->assigned_employee_id !== null) {
            return null;
        }

        $original = $lead->duplicateOf;
        if ($original?->assigned_employee_id !== null && self::eligibleEmployees()->whereKey($original->assigned_employee_id)->exists()) {
            return $this->applyAssignment($lead, $original->assignedEmployee, null, 'Duplicate of a lead owned by this employee', 'auto');
        }

        $query = self::eligibleEmployees()->where('is_demo', (bool) $lead->is_demo);
        if ($teamId = $this->settings->get('crm.auto_assign_team_id')) {
            $query->where('team_id', (int) $teamId);
        }

        $candidate = $query
            ->withCount(['assignedLeads as open_leads_count' => fn (Builder $q) => $q->whereIn('status', LeadStatus::openValues())])
            ->withMax('assignedLeads as last_assigned_at', 'assigned_at')
            ->get()
            ->sortBy([['open_leads_count', 'asc'], ['last_assigned_at', 'asc'], ['id', 'asc']])
            ->first();

        return $candidate === null ? null : $this->applyAssignment($lead, $candidate, null, 'Automatic assignment by workload', 'auto');
    }

    private function applyAssignment(Lead $lead, ?Employee $to, ?User $actor, string $reason, string $method): Lead
    {
        return DB::transaction(function () use ($lead, $to, $actor, $reason, $method): Lead {
            $from = $lead->assigned_employee_id;

            $lead->forceFill([
                'assigned_employee_id' => $to?->id,
                'assigned_at' => $to === null ? null : now(),
                'team_leader_employee_id' => $to?->team?->leader_employee_id,
            ])->save();

            LeadAssignment::create([
                'lead_id' => $lead->id,
                'from_employee_id' => $from,
                'to_employee_id' => $to?->id,
                'assigned_by' => $actor?->id,
                'method' => $method,
                'reason' => $reason,
            ]);

            LeadActivity::create([
                'lead_id' => $lead->id,
                'type' => 'assigned',
                'actor_user_id' => $actor?->id,
                'summary' => $to === null ? 'Unassigned' : 'Assigned to '.$to->user?->name,
                'details' => ['method' => $method, 'reason' => $reason, 'from_employee_id' => $from],
                'occurred_at' => now(),
            ]);

            $this->audit->record('lead.assigned', $lead, ['assigned_employee_id' => $from], ['assigned_employee_id' => $to?->id], $reason, $actor, $actor ? 'user' : 'system');

            return $lead;
        });
    }

    /**
     * Active staff who can work leads.
     *
     * @return Builder<Employee>
     */
    private static function eligibleEmployees(): Builder
    {
        return Employee::query()
            ->where('status', 'active')
            ->whereHas('user', fn (Builder $u) => $u->where('status', User::STATUS_ACTIVE)
                ->where('user_type', User::TYPE_STAFF)
                ->whereHas('roles.permissions', fn (Builder $p) => $p->whereIn('name', ['leads.view_own', 'leads.view_team'])));
    }
}
