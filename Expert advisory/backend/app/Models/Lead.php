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

#[Fillable([
    'full_name', 'mobile', 'email', 'city', 'state', 'country', 'trading_experience', 'demat_status', 'broker',
    'capital_range', 'preferred_segments', 'equity_interest', 'options_interest', 'commodity_interest',
    'investment_horizon', 'risk_level_declared', 'lead_source_id', 'campaign_id', 'vendor_id', 'referral_code',
    'team_leader_employee_id', 'duplicate_of_lead_id', 'message', 'import_id', 'is_demo',
])]
class Lead extends Model
{
    use HasDemoFlag, HasFactory, SoftDeletes;

    public const STATUSES = [
        'NEW', 'NPC', 'CALL_BACK', 'FOLLOW_UP', 'FREE_TRIAL', 'EXPECTED_PAYMENT', 'PAID',
        'NOT_INTERESTED', 'DND', 'INVALID', 'CONVERTED', 'LOST',
    ];

    protected function casts(): array
    {
        return [
            'preferred_segments' => 'array',
            'equity_interest' => 'boolean',
            'options_interest' => 'boolean',
            'commodity_interest' => 'boolean',
            'assigned_at' => 'datetime',
            'dnd_at' => 'datetime',
            'escalated_at' => 'datetime',
            'last_contacted_at' => 'datetime',
            'next_followup_at' => 'datetime',
            'conversion_probability' => 'decimal:4',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Lead $lead): void {
            $lead->uuid ??= (string) Str::uuid7();
            $lead->status ??= 'NEW';
        });
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(LeadSource::class, 'lead_source_id');
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function assignedEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_employee_id');
    }

    public function teamLeader(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'team_leader_employee_id');
    }

    public function duplicateOf(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'duplicate_of_lead_id');
    }

    public function attributions(): HasMany
    {
        return $this->hasMany(LeadAttribution::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(LeadActivity::class)->latest('occurred_at')->latest('id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LeadAssignment::class)->latest('id');
    }

    public function callLogs(): HasMany
    {
        return $this->hasMany(CallLog::class)->latest('called_at');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(Followup::class)->orderBy('due_at');
    }

    public function consents(): HasMany
    {
        return $this->hasMany(ConsentRecord::class, 'subject_id')->where('subject_type', 'lead')->orderByDesc('captured_at');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(LeadStatusHistory::class);
    }

    /**
     * Record-level scope: own → team → all, based on the strongest permission held.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('leads.view_all')) {
            return $query;
        }

        $employee = $user->employee;

        if ($employee === null) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->can('leads.view_team') && $employee->team_id !== null) {
            return $query->where(function (Builder $q) use ($employee): void {
                $q->whereIn('assigned_employee_id', Employee::query()->select('id')->where('team_id', $employee->team_id))
                    ->orWhere('team_leader_employee_id', $employee->id);
            });
        }

        if ($user->can('leads.view_own') || $user->can('leads.view_team')) {
            return $query->where('assigned_employee_id', $employee->id);
        }

        return $query->whereRaw('1 = 0');
    }
}
