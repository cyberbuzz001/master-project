<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['client_id', 'key', 'label', 'status', 'is_required', 'sort_order', 'notes'])]
class OnboardingStep extends Model
{
    public const PENDING = 'pending';

    public const IN_PROGRESS = 'in_progress';

    public const COMPLETED = 'completed';

    public const SKIPPED = 'skipped';

    public const BLOCKED = 'blocked';

    protected $attributes = ['status' => self::PENDING];

    protected function casts(): array
    {
        return ['is_required' => 'boolean', 'completed_at' => 'datetime'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
