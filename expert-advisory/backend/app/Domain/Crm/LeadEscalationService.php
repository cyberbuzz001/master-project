<?php

namespace App\Domain\Crm;

use App\Domain\Platform\Settings;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\User;
use Filament\Notifications\Notification;
use Illuminate\Database\Eloquent\Builder;

/**
 * Flags leads nobody has acted on: NEW leads not called within the first-contact window, and open
 * leads idle beyond the idle window. Escalation clears automatically when anyone works the lead.
 */
final class LeadEscalationService
{
    public function __construct(private readonly Settings $settings) {}

    /**
     * @return int number of newly escalated leads
     */
    public function sweep(): int
    {
        $newHours = (int) $this->settings->get('crm.escalation_new_hours', 2);
        $idleHours = (int) $this->settings->get('crm.escalation_idle_hours', 24);
        $count = 0;

        Lead::query()->withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->whereNull('escalated_at')
            ->whereNull('duplicate_of_lead_id')
            ->where(function (Builder $q) use ($newHours, $idleHours): void {
                $q->where(fn (Builder $n) => $n->where('status', 'NEW')->whereNull('last_contacted_at')->where('created_at', '<', now()->subHours($newHours)))
                    ->orWhere(fn (Builder $o) => $o->whereIn('status', ['NPC', 'CALL_BACK', 'FOLLOW_UP', 'FREE_TRIAL', 'EXPECTED_PAYMENT'])
                        ->where(fn (Builder $idle) => $idle->where('last_contacted_at', '<', now()->subHours($idleHours))->orWhere(fn (Builder $never) => $never->whereNull('last_contacted_at')->where('updated_at', '<', now()->subHours($idleHours))))
                        ->where(fn (Builder $due) => $due->whereNull('next_followup_at')->orWhere('next_followup_at', '<', now())));
            })
            ->with(['assignedEmployee.user', 'teamLeader.user'])
            ->chunkById(200, function ($leads) use (&$count, $newHours, $idleHours): void {
                $managers = null;

                foreach ($leads as $lead) {
                    $reason = $lead->status === 'NEW'
                        ? "Not contacted within {$newHours} hours of arrival"
                        : "No contact for over {$idleHours} hours and no follow-up scheduled";

                    $lead->forceFill(['escalated_at' => now()])->saveQuietly();

                    LeadActivity::create([
                        'lead_id' => $lead->id,
                        'type' => 'escalated',
                        'summary' => 'Escalated: '.$reason,
                        'details' => ['reason' => $reason],
                        'occurred_at' => now(),
                    ]);

                    $recipients = collect([$lead->assignedEmployee?->user, $lead->teamLeader?->user])->filter();
                    if ($lead->assigned_employee_id === null) {
                        $managers ??= User::permission('leads.assign')->where('status', User::STATUS_ACTIVE)->whereHas('roles.permissions', fn (Builder $p) => $p->where('name', 'leads.view_all'))->get();
                        $recipients = $recipients->merge($managers);
                    }

                    foreach ($recipients->unique('id') as $user) {
                        Notification::make()->title('Lead escalated: '.$lead->full_name)->body($reason)->warning()->sendToDatabase($user);
                    }

                    $count++;
                }
            });

        return $count;
    }

    public static function clear(Lead $lead): void
    {
        if ($lead->escalated_at !== null) {
            $lead->forceFill(['escalated_at' => null])->save();
        }
    }
}
