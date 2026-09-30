<?php

namespace App\Domain\Identity;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

final class RoleAssignmentService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Replaces a user's roles with separation-of-duty checks.
     *
     * @param  list<string>  $roleNames
     */
    public function sync(User $actor, User $target, array $roleNames, string $reason): void
    {
        $roleNames = array_values(array_unique($roleNames));

        if ($actor->is($target)) {
            throw ApiException::forbidden('You cannot change your own roles.', 'SELF_ROLE_CHANGE_FORBIDDEN');
        }

        $roles = Role::query()->whereIn('name', $roleNames)->get();

        if ($roles->count() !== count($roleNames)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'One or more roles do not exist.', ['roles' => ['One or more roles do not exist.']]);
        }

        $current = $target->getRoleNames()->all();
        $privileged = config('rbac.privileged_roles');
        $touchedPrivileged = array_intersect(array_merge(array_diff($roleNames, $current), array_diff($current, $roleNames)), $privileged);

        if ($touchedPrivileged !== [] && ! $actor->can('roles.assign_privileged')) {
            throw ApiException::forbidden('Only a Super Admin can grant or revoke privileged roles.', 'PRIVILEGED_ROLE_FORBIDDEN');
        }

        $isClientRole = in_array('client', $roleNames, true);

        if ($isClientRole && count($roleNames) > 1) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'The client role cannot be combined with staff roles.', ['roles' => ['The client role cannot be combined with staff roles.']]);
        }

        if (($target->isClient() && $roleNames !== [] && ! $isClientRole) || ($target->isStaff() && $isClientRole)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Roles must match the user type.', ['roles' => ['Roles must match the user type.']]);
        }

        if (in_array('super_admin', $current, true) && ! in_array('super_admin', $roleNames, true)) {
            $remaining = User::role('super_admin')->where('status', User::STATUS_ACTIVE)->whereKeyNot($target->id)->count();

            if ($remaining === 0) {
                throw new ApiException('LAST_SUPER_ADMIN', 'The last active Super Admin cannot be removed.', 409);
            }
        }

        DB::transaction(function () use ($target, $roleNames, $current, $reason): void {
            $target->syncRoles($roleNames);
            $this->audit->record('user.roles_changed', $target, ['roles' => $current], ['roles' => $roleNames], $reason);
        });
    }
}
