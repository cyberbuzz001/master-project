<?php

namespace App\Domain\Identity;

use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Writes config/rbac.php into the database. Idempotent; removes permissions no longer in the catalogue.
 */
final class RbacSynchronizer
{
    /**
     * @return array{permissions: int, roles: int}
     */
    public function sync(): array
    {
        $guard = config('rbac.guard');
        $catalogue = config('rbac.permissions');
        $privileged = config('rbac.privileged_roles');

        DB::transaction(function () use ($guard, $catalogue, $privileged): void {
            $names = [];

            foreach ($catalogue as $module => $permissions) {
                foreach ($permissions as $name => $label) {
                    $names[] = $name;
                    $permission = Permission::findOrCreate($name, $guard);
                    $permission->forceFill(['module' => $module, 'label' => $label])->save();
                }
            }

            Permission::query()->where('guard_name', $guard)->whereNotIn('name', $names)->delete();

            foreach (config('rbac.roles') as $name => $definition) {
                $role = Role::findOrCreate($name, $guard);
                $role->forceFill([
                    'label' => $definition['label'],
                    'is_staff' => $definition['staff'],
                    'requires_2fa' => $definition['requires_2fa'],
                    'is_privileged' => in_array($name, $privileged, true),
                ])->save();

                $unknown = array_diff($definition['permissions'], $names);

                if ($unknown !== []) {
                    throw new \LogicException("Role {$name} references unknown permissions: ".implode(', ', $unknown));
                }

                $role->syncPermissions(array_values(array_unique($definition['permissions'])));
            }
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return [
            'permissions' => Permission::query()->count(),
            'roles' => Role::query()->count(),
        ];
    }
}
