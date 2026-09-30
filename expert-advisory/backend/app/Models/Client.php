<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['user_id', 'client_code', 'lead_id', 'full_name', 'email', 'mobile', 'city', 'state', 'country', 'relationship_manager_employee_id', 'is_demo'])]
class Client extends Model
{
    use HasDemoFlag, HasFactory, SoftDeletes;

    protected $attributes = ['onboarding_status' => 'LEAD', 'kyc_status' => 'pending', 'country' => 'India'];

    protected function casts(): array
    {
        return [
            'is_demo' => 'boolean',
            'onboarded_at' => 'datetime',
            'converted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Client $client): void {
            $client->uuid ??= (string) Str::uuid7();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function relationshipManager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'relationship_manager_employee_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function riskProfile(): BelongsTo
    {
        return $this->belongsTo(RiskProfile::class, 'risk_profile_id');
    }

    public function riskProfiles(): HasMany
    {
        return $this->hasMany(RiskProfile::class)->latest('id');
    }

    public function kycChecks(): HasMany
    {
        return $this->hasMany(KycCheck::class);
    }

    public function onboardingSteps(): HasMany
    {
        return $this->hasMany(OnboardingStep::class)->orderBy('sort_order');
    }

    public function agreementAcceptances(): HasMany
    {
        return $this->hasMany(AgreementAcceptance::class)->latest('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'owner_id')->where('owner_type', 'client')->latest('id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function researchDistributions(): HasMany
    {
        return $this->hasMany(ResearchDistribution::class);
    }

    /**
     * Record-level scope mirroring leads: own → team → all.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('clients.view_all')) {
            return $query;
        }

        $employee = $user->employee;

        if ($employee === null) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->can('clients.view_team') && $employee->team_id !== null) {
            return $query->whereIn(
                'relationship_manager_employee_id',
                Employee::query()->select('id')->where('team_id', $employee->team_id),
            );
        }

        if ($user->can('clients.view_own')) {
            return $query->where('relationship_manager_employee_id', $employee->id);
        }

        return $query->whereRaw('1 = 0');
    }
}
