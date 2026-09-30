<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'recommendation_id',
    'published_at',
    'entry_ref',
    'high_after',
    'low_after',
    'close_ref',
    'mfe',
    'mae',
    'outcome',
    'methodology_version',
    'computed_at',
])]
class ResearchPerformance extends Model
{
    use HasFactory;

    public $table = 'research_performance';

    public const OUTCOME_PENDING = 'PENDING';
    public const OUTCOME_TARGET_HIT = 'TARGET_HIT';
    public const OUTCOME_STOP_LOSS_HIT = 'STOP_LOSS_HIT';
    public const OUTCOME_EXPIRED = 'EXPIRED';
    public const OUTCOME_SCRATCH = 'SCRATCH';

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'computed_at' => 'datetime',
            'entry_ref' => 'decimal:4',
            'high_after' => 'decimal:4',
            'low_after' => 'decimal:4',
            'close_ref' => 'decimal:4',
            'mfe' => 'decimal:4',
            'mae' => 'decimal:4',
        ];
    }

    public function recommendation(): BelongsTo
    {
        return $this->belongsTo(ResearchRecommendation::class, 'recommendation_id');
    }
}
