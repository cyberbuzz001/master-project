<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'mobile', 'password', 'user_type', 'status', 'is_demo'])]
#[Hidden(['password', 'remember_token', 'two_factor_secret'])]
class User extends Authenticatable implements FilamentUser
{
    public const TYPE_STAFF = 'staff';

    public const TYPE_CLIENT = 'client';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_DEACTIVATED = 'deactivated';

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasDemoFlag, HasFactory, HasRoles, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_changed_at' => 'datetime',
            'two_factor_secret' => 'encrypted',
            'two_factor_confirmed_at' => 'datetime',
            'locked_until' => 'datetime',
            'last_login_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (User $user): void {
            $user->uuid ??= (string) Str::uuid7();
            $user->password_changed_at ??= now();
        });
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function client(): HasOne
    {
        return $this->hasOne(Client::class);
    }

    public function loginHistories(): HasMany
    {
        return $this->hasMany(LoginHistory::class);
    }

    public function recoveryCodes(): HasMany
    {
        return $this->hasMany(TwoFactorRecoveryCode::class);
    }

    public function isStaff(): bool
    {
        return $this->user_type === self::TYPE_STAFF;
    }

    public function isClient(): bool
    {
        return $this->user_type === self::TYPE_CLIENT;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    /**
     * True when any assigned role mandates 2FA (and enforcement is on).
     */
    public function requiresTwoFactor(): bool
    {
        if (! config('platform.security.enforce_staff_2fa')) {
            return false;
        }

        return $this->roles->contains(fn ($role) => (bool) $role->requires_2fa);
    }

    public function isAuthorizedResearchPerson(): bool
    {
        return (bool) $this->employee?->is_authorized_research_person;
    }

    /**
     * Staff back-office access. Clients never enter the panel.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->isStaff()
            && $this->isActive()
            && array_intersect($this->areas(), ['admin', 'manager', 'research', 'workspace']) !== [];
    }

    /**
     * Portal areas the user may enter, derived from permissions.
     *
     * @return list<string>
     */
    public function areas(): array
    {
        $map = [
            'admin' => 'dashboard.admin.view',
            'manager' => 'dashboard.manager.view',
            'research' => 'dashboard.research.view',
            'workspace' => 'dashboard.employee.view',
            'portal' => 'portal.access',
        ];

        return array_keys(array_filter($map, fn (string $permission) => $this->can($permission)));
    }
}
