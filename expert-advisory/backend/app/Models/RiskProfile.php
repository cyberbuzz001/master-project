<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use LogicException;

#[Fillable([])]
class RiskProfile extends Model
{
    use HasDemoFlag;

    public const SUBMITTED = 'submitted';

    public const FINALIZED = 'finalized';

    public const SUPERSEDED = 'superseded';

    protected $attributes = ['status' => self::SUBMITTED];

    protected function casts(): array
    {
        return [
            'suitability_flags' => 'array',
            'finalized_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (RiskProfile $profile): void {
            $profile->uuid ??= (string) Str::uuid7();
        });

        // The assessment itself never changes; only its lifecycle does.
        static::updating(function (RiskProfile $profile): void {
            if ($profile->isDirty(['raw_score', 'max_score', 'answers_sha256', 'methodology_version', 'risk_questionnaire_version_id', 'client_id'])) {
                throw new LogicException('A submitted risk assessment is immutable. Ask the client to retake it.');
            }
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function questionnaireVersion(): BelongsTo
    {
        return $this->belongsTo(RiskQuestionnaireVersion::class, 'risk_questionnaire_version_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(RiskAnswer::class)->orderBy('id');
    }

    public function overrides(): HasMany
    {
        return $this->hasMany(RiskOverride::class)->orderByDesc('id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function scorePercent(): float
    {
        return $this->max_score > 0 ? round($this->raw_score / $this->max_score * 100, 1) : 0.0;
    }
}
