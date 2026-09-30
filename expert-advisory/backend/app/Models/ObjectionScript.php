<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sales scripts are client-facing speech, so staff only see approved versions.
 * Editing an approved script returns it to draft for compliance review.
 */
#[Fillable(['objection', 'tag', 'response'])]
class ObjectionScript extends Model
{
    public const DRAFT = 'draft';

    public const APPROVED = 'approved';

    public const RETIRED = 'retired';

    protected function casts(): array
    {
        return ['approved_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(function (ObjectionScript $script): void {
            if ($script->getOriginal('status') === self::APPROVED && $script->isDirty(['objection', 'response'])) {
                $script->status = self::DRAFT;
                $script->approved_by = null;
                $script->approved_at = null;
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
