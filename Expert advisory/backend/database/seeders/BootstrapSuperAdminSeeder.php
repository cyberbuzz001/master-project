<?php

namespace Database\Seeders;

use App\Domain\Audit\AuditLogger;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creates the first Super Admin from INITIAL_SUPER_ADMIN_* env values. Does nothing when one already exists.
 */
class BootstrapSuperAdminSeeder extends Seeder
{
    public function run(AuditLogger $audit): void
    {
        if (User::role('super_admin')->withoutGlobalScopes()->exists()) {
            return;
        }

        $email = config('platform.bootstrap.super_admin_email');

        if (! is_string($email) || $email === '') {
            $this->command?->warn('No Super Admin created: set INITIAL_SUPER_ADMIN_EMAIL (or run `php artisan platform:create-super-admin`).');

            return;
        }

        $password = config('platform.bootstrap.super_admin_password');
        $generated = false;

        if (! is_string($password) || $password === '') {
            if (app()->isProduction()) {
                $this->command?->error('INITIAL_SUPER_ADMIN_PASSWORD is required in production.');

                return;
            }

            $password = Str::password(20);
            $generated = true;
        }

        DB::transaction(function () use ($email, $password, $audit): void {
            $user = User::create([
                'name' => config('platform.bootstrap.super_admin_name'),
                'email' => mb_strtolower($email),
                'password' => $password,
                'user_type' => User::TYPE_STAFF,
                'status' => User::STATUS_ACTIVE,
            ]);
            $user->assignRole('super_admin');

            $employee = Employee::create(['user_id' => $user->id, 'employee_code' => 'TMP-'.$user->id, 'designation' => 'Super Admin']);
            $employee->forceFill(['employee_code' => sprintf('ESC-%05d', $employee->id)])->save();

            $audit->record('user.bootstrap_super_admin', $user, new: ['email' => $user->email], actorType: 'system');
        });

        $this->command?->info("Super Admin created: {$email}");

        if ($generated) {
            $this->command?->warn("Generated password (shown once): {$password}");
        }
    }
}
