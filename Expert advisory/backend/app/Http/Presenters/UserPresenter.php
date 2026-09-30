<?php

namespace App\Http\Presenters;

use App\Http\Middleware\RequireTwoFactor;
use App\Models\User;
use Illuminate\Http\Request;

final class UserPresenter
{
    /**
     * Full payload for the signed-in user.
     *
     * @return array<string, mixed>
     */
    public static function me(User $user, Request $request): array
    {
        $user->loadMissing(['roles', 'employee.team', 'client']);

        $passedTwoFactor = $request->hasSession() && $request->session()->get(RequireTwoFactor::SESSION_KEY) !== null;

        return [
            'id' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'user_type' => $user->user_type,
            'status' => $user->status,
            'roles' => $user->roles->map(fn ($r) => ['name' => $r->name, 'label' => $r->label])->values(),
            'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values(),
            'areas' => $user->areas(),
            'two_factor' => [
                'enabled' => $user->hasTwoFactorEnabled(),
                'required' => $user->requiresTwoFactor(),
                'enrollment_required' => $user->requiresTwoFactor() && ! $user->hasTwoFactorEnabled(),
                'verified_this_session' => $passedTwoFactor,
            ],
            'employee' => $user->employee === null ? null : [
                'employee_code' => $user->employee->employee_code,
                'designation' => $user->employee->designation,
                'team' => $user->employee->team?->name,
                'is_authorized_research_person' => $user->employee->is_authorized_research_person,
            ],
            'client' => $user->client === null ? null : [
                'client_code' => $user->client->client_code,
                'onboarding_status' => $user->client->onboarding_status,
            ],
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'password_changed_at' => $user->password_changed_at?->toIso8601String(),
            'demo_mode' => (bool) config('platform.demo_mode'),
        ];
    }

    /**
     * Admin listing row. Never includes secrets.
     *
     * @return array<string, mixed>
     */
    public static function admin(User $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'user_type' => $user->user_type,
            'status' => $user->status,
            'is_locked' => $user->isLocked(),
            'locked_until' => $user->locked_until?->toIso8601String(),
            'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            'roles' => $user->roles->map(fn ($r) => ['name' => $r->name, 'label' => $r->label])->values(),
            'employee' => $user->employee === null ? null : [
                'id' => $user->employee->id,
                'employee_code' => $user->employee->employee_code,
                'designation' => $user->employee->designation,
                'team_id' => $user->employee->team_id,
                'team' => $user->employee->team?->name,
                'is_authorized_research_person' => $user->employee->is_authorized_research_person,
            ],
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'is_demo' => $user->is_demo,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
