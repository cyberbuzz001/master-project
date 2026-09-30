<?php

namespace App\Domain\Identity;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Staff account lifecycle shared by the API and the back-office. Every change is audited with a reason.
 */
final class StaffUserService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RoleAssignmentService $roles,
    ) {}

    /**
     * @param  array{name: string, email: string, mobile?: ?string, password: string, designation?: ?string, team_id?: ?int, reports_to_employee_id?: ?int, roles: list<string>, reason: string}  $data
     */
    public function create(User $actor, array $data): User
    {
        if (! $actor->can('users.create') || ! $actor->can('roles.assign')) {
            throw ApiException::forbidden();
        }

        return DB::transaction(function () use ($actor, $data): User {
            $user = User::create([
                'name' => $data['name'],
                'email' => mb_strtolower(trim($data['email'])),
                'mobile' => $data['mobile'] ?? null,
                'password' => $data['password'],
                'user_type' => User::TYPE_STAFF,
                'status' => User::STATUS_ACTIVE,
            ]);

            $employee = Employee::create([
                'user_id' => $user->id,
                'employee_code' => 'TMP-'.$user->id,
                'designation' => $data['designation'] ?? null,
                'team_id' => $data['team_id'] ?? null,
                'reports_to_employee_id' => $data['reports_to_employee_id'] ?? null,
                'joined_on' => now()->toDateString(),
            ]);
            $employee->forceFill(['employee_code' => sprintf('ESC-%05d', $employee->id)])->save();

            $this->audit->record('user.created', $user, new: [
                'email' => $user->email, 'user_type' => $user->user_type, 'employee_code' => $employee->employee_code,
            ], reason: $data['reason']);

            $this->roles->sync($actor, $user, $data['roles'], $data['reason']);

            return $user;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $actor, User $user, array $data, string $reason): User
    {
        if (! $actor->can('users.update')) {
            throw ApiException::forbidden();
        }

        return DB::transaction(function () use ($user, $data, $reason): User {
            $original = $user->getOriginal();
            $user->fill(array_intersect_key($data, array_flip(['name', 'mobile'])))->save();
            if ($user->wasChanged()) {
                $this->audit->recordChanges('user.updated', $user, $original, $reason);
            }

            if ($user->employee !== null) {
                $employee = $user->employee;
                $originalEmployee = $employee->getOriginal();
                $employee->fill(array_intersect_key($data, array_flip(['designation', 'team_id', 'reports_to_employee_id'])))->save();
                if ($employee->wasChanged()) {
                    $this->audit->recordChanges('employee.updated', $employee, $originalEmployee, $reason);
                }
            }

            return $user;
        });
    }

    public function deactivate(User $actor, User $user, string $reason): User
    {
        if (! $actor->can('users.deactivate')) {
            throw ApiException::forbidden();
        }

        if ($actor->is($user)) {
            throw ApiException::forbidden('You cannot deactivate your own account.', 'SELF_DEACTIVATION_FORBIDDEN');
        }

        $this->assertMayManagePrivileged($actor, $user, 'deactivate');

        if ($user->hasRole('super_admin')
            && User::role('super_admin')->where('status', User::STATUS_ACTIVE)->whereKeyNot($user->id)->doesntExist()) {
            throw new ApiException('LAST_SUPER_ADMIN', 'The last active Super Admin cannot be deactivated.', 409);
        }

        return DB::transaction(function () use ($user, $reason): User {
            $old = $user->status;
            $user->forceFill(['status' => User::STATUS_DEACTIVATED])->save();
            $user->tokens()->delete();

            if (config('session.driver') === 'database') {
                DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
            }

            $this->audit->record('user.deactivated', $user, ['status' => $old], ['status' => User::STATUS_DEACTIVATED], $reason);

            return $user;
        });
    }

    public function reactivate(User $actor, User $user, string $reason): User
    {
        if (! $actor->can('users.deactivate')) {
            throw ApiException::forbidden();
        }

        $this->assertMayManagePrivileged($actor, $user, 'reactivate');

        $old = $user->status;
        $user->forceFill(['status' => User::STATUS_ACTIVE])->save();
        $this->audit->record('user.reactivated', $user, ['status' => $old], ['status' => User::STATUS_ACTIVE], $reason);

        return $user;
    }

    public function unlock(User $actor, User $user, string $reason): User
    {
        if (! $actor->can('users.update')) {
            throw ApiException::forbidden();
        }

        $user->forceFill(['locked_until' => null, 'failed_login_count' => 0])->save();
        $this->audit->record('user.unlocked', $user, reason: $reason);

        return $user;
    }

    public function setResearchAuthorization(User $actor, User $user, bool $authorized, string $reason): User
    {
        if (! $actor->can('research_persons.authorize')) {
            throw ApiException::forbidden();
        }

        $employee = $user->employee ?? throw new ApiException('NOT_AN_EMPLOYEE', 'This user is not an employee.', 422);

        if ($actor->is($user)) {
            throw ApiException::forbidden('You cannot change your own research authorization.', 'SEPARATION_OF_DUTIES');
        }

        $old = $employee->is_authorized_research_person;
        $employee->forceFill([
            'is_authorized_research_person' => $authorized,
            'research_authorized_by' => $authorized ? $actor->id : null,
            'research_authorized_at' => $authorized ? now() : null,
        ])->save();

        $this->audit->record('employee.research_authorization_changed', $employee,
            ['is_authorized_research_person' => $old], ['is_authorized_research_person' => $authorized], $reason);

        return $user;
    }

    private function assertMayManagePrivileged(User $actor, User $user, string $verb): void
    {
        if ($user->hasRole('super_admin') && ! $actor->hasRole('super_admin')) {
            throw ApiException::forbidden("Only a Super Admin can {$verb} a Super Admin.", 'PRIVILEGED_ROLE_FORBIDDEN');
        }
    }
}
