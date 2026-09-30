<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'research_version_id',
    'instrument',
    'exchange',
    'segment',
    'direction',
    'entry_low',
    'entry_high',
    'stop_loss',
    'targets',
    'time_horizon',
    'risk_classification',
    'risk_reward',
    'invalidation_condition',
    'data_as_of',
    'status',
])]
class ResearchRecommendation extends Model
{
    use HasFactory;

    public const DIRECTION_BUY = 'BUY';
    public const DIRECTION_SELL = 'SELL';
    public const DIRECTION_HOLD = 'HOLD';
    public const DIRECTION_ACCUMULATE = 'ACCUMULATE';

    public const SEGMENT_CASH = 'EQUITY_CASH';
    public const SEGMENT_FUTURES = 'EQUITY_FUTURES';
    public const SEGMENT_OPTIONS = 'EQUITY_OPTIONS';
    public const SEGMENT_COMMODITY = 'COMMODITY';
    public const SEGMENT_CURRENCY = 'CURRENCY';

    public const RISK_LOW = 'LOW';
    public const RISK_MODERATE = 'MODERATE';
    public const RISK_HIGH = 'HIGH';
    public const RISK_VERY_HIGH = 'VERY_HIGH';

    public const STATUS_ACTIVE = 'ACTIVE';
    public const STATUS_TARGET_HIT = 'TARGET_HIT';
    public const STATUS_STOP_LOSS_HIT = 'STOP_LOSS_HIT';
    public const STATUS_EXPIRED = 'EXPIRED';
    public const STATUS_CLOSED = 'CLOSED';
    public const STATUS_CANCELLED = 'CANCELLED';

    protected function casts(): array
    {
        return [
            'entry_low' => 'decimal:4',
            'entry_high' => 'decimal:4',
            'stop_loss' => 'decimal:4',
            'risk_reward' => 'decimal:4',
            'targets' => 'array',
            'data_as_of' => 'datetime',
        ];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(ResearchVersion::class, 'research_version_id');
    }

    public function performance(): HasOne
    {
        return $this->hasOne(ResearchPerformance::class, 'recommendation_id');
    }

    /**
     * Compute reference entry price (midpoint of entry range).
     */
    public function entryReference(): float
    {
        return round(((float) $this->entry_low + (float) $this->entry_high) / 2.0, 4);
    }
}
