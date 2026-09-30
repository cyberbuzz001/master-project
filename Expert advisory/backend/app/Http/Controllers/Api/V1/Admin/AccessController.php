<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\AuditLog;
use App\Models\LoginHistory;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Read-mostly admin endpoints: roles, teams, audit trail and login history.
 */
final class AccessController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function roles(): JsonResponse
    {
        $roles = Role::query()->with('permissions:id,name')->withCount('users')->orderBy('id')->get()->map(fn (Role $role) => [
            'name' => $role->name,
            'label' => $role->label,
            'is_staff' => (bool) $role->is_staff,
            'requires_2fa' => (bool) $role->requires_2fa,
            'is_privileged' => (bool) $role->is_privileged,
            'users_count' => $role->users_count,
            'permissions' => $role->permissions->pluck('name')->sort()->values(),
        ]);

        $permissions = Permission::query()->orderBy('module')->orderBy('name')->get(['name', 'module', 'label'])
            ->groupBy('module')
            ->map(fn ($group) => $group->map->only(['name', 'label'])->values());

        return ApiResponse::success(['roles' => $roles, 'permissions' => $permissions]);
    }

    public function teams(): JsonResponse
    {
        $teams = Team::query()->with('leader.user:id,name')->withCount('employees')->orderBy('name')->get()->map(fn (Team $team) => [
            'id' => $team->id,
            'name' => $team->name,
            'description' => $team->description,
            'leader' => $team->leader === null ? null : ['employee_id' => $team->leader->id, 'name' => $team->leader->user?->name],
            'employees_count' => $team->employees_count,
            'is_active' => $team->is_active,
        ]);

        return ApiResponse::success($teams);
    }

    public function storeTeam(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('teams', 'name')],
            'description' => ['nullable', 'string', 'max:255'],
            'leader_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $team = Team::create($data);
        $this->audit->record('team.created', $team, new: $data);

        return ApiResponse::success(['id' => $team->id, 'name' => $team->name], status: 201);
    }

    public function updateTeam(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120', Rule::unique('teams', 'name')->ignore($team->id)],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'leader_employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $original = $team->getOriginal();
        $team->fill($data)->save();
        $this->audit->recordChanges('team.updated', $team, $original);

        return ApiResponse::success(['id' => $team->id, 'name' => $team->name]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter.action' => ['nullable', 'string', 'max:96'],
            'filter.actor_user_id' => ['nullable', 'integer'],
            'filter.subject_type' => ['nullable', 'string', 'max:96'],
            'filter.subject_id' => ['nullable', 'integer'],
            'filter.request_id' => ['nullable', 'uuid'],
            'filter.from' => ['nullable', 'date'],
            'filter.to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()->with('actor:id,name,email')->latest('id');

        foreach (['actor_user_id', 'subject_id', 'request_id'] as $field) {
            if (($value = data_get($filters, "filter.{$field}")) !== null) {
                $query->where($field, $value);
            }
        }
        if ($action = data_get($filters, 'filter.action')) {
            $query->where('action', 'like', $action.'%');
        }
        if ($subjectType = data_get($filters, 'filter.subject_type')) {
            $query->where('subject_type', $subjectType);
        }
        if ($from = data_get($filters, 'filter.from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = data_get($filters, 'filter.to')) {
            $query->where('created_at', '<=', $to);
        }

        return ApiResponse::paginated($query->paginate($filters['per_page'] ?? 50), fn (AuditLog $log) => [
            'id' => $log->id,
            'request_id' => $log->request_id,
            'actor' => $log->actor === null ? null : ['id' => $log->actor->id, 'name' => $log->actor->name, 'email' => $log->actor->email],
            'actor_type' => $log->actor_type,
            'action' => $log->action,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'reason' => $log->reason,
            'ip' => $log->ip,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toIso8601String(),
        ]);
    }

    public function loginHistory(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter.user_id' => ['nullable', 'integer'],
            'filter.outcome' => ['nullable', 'string', 'max:24'],
            'filter.ip' => ['nullable', 'ip'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = LoginHistory::query()->with('user:id,name,email')->latest('id');

        foreach (['user_id', 'outcome', 'ip'] as $field) {
            if (($value = data_get($filters, "filter.{$field}")) !== null) {
                $query->where($field, $value);
            }
        }

        return ApiResponse::paginated($query->paginate($filters['per_page'] ?? 50), fn (LoginHistory $row) => [
            'id' => $row->id,
            'user' => $row->user === null ? null : ['id' => $row->user->id, 'name' => $row->user->name],
            'email_attempted' => $row->email_attempted,
            'outcome' => $row->outcome,
            'ip' => $row->ip,
            'user_agent' => $row->user_agent,
            'created_at' => $row->created_at?->toIso8601String(),
        ]);
    }
}
