<?php

namespace App\Console\Commands;

use App\Domain\Audit\AuditLogger;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

#[Signature('platform:create-super-admin {email} {--name=Super Admin}')]
#[Description('Create a Super Admin account (password is prompted, never passed as an argument)')]
class CreateSuperAdmin extends Command
{
    public function handle(AuditLogger $audit): int
    {
        $email = mb_strtolower((string) $this->argument('email'));
        $password = (string) $this->secret('Password (min 12 chars, mixed case, number, symbol)');

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['required', 'email', 'unique:users,email'], 'password' => ['required', Password::defaults()]],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        DB::transaction(function () use ($email, $password, $audit): void {
            $user = User::create([
                'name' => (string) $this->option('name'),
                'email' => $email,
                'password' => $password,
                'user_type' => User::TYPE_STAFF,
                'status' => User::STATUS_ACTIVE,
            ]);
            $user->assignRole('super_admin');

            $employee = Employee::create(['user_id' => $user->id, 'employee_code' => 'TMP-'.$user->id, 'designation' => 'Super Admin']);
            $employee->forceFill(['employee_code' => sprintf('ESC-%05d', $employee->id)])->save();

            $audit->record('user.super_admin_created_cli', $user, new: ['email' => $email], actorType: 'system');
        });

        $this->info("Super Admin {$email} created. Two-factor enrollment is required at first sign-in.");

        return self::SUCCESS;
    }
}
