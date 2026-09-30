<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

#[Fillable(['agreement_id', 'version', 'body_markdown', 'effective_from', 'created_by'])]
class AgreementVersion extends Model
{
    public const DRAFT = 'draft';

    public const IN_REVIEW = 'in_review';

    public const PUBLISHED = 'published';

    public const RETIRED = 'retired';

    protected $attributes = ['status' => self::DRAFT];

    protected function casts(): array
    {
        return ['effective_from' => 'date', 'approved_at' => 'datetime', 'published_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::saving(function (AgreementVersion $version): void {
            if ($version->isDirty('body_markdown')) {
                $version->body_sha256 = hash('sha256', (string) $version->body_markdown);
            }
        });

        // Once it has left draft, the text a client accepted can never be edited.
        static::updating(function (AgreementVersion $version): void {
            if ($version->getOriginal('status') !== self::DRAFT && $version->isDirty(['body_markdown', 'body_sha256', 'version', 'agreement_id'])) {
                throw new LogicException('Agreement text is immutable once submitted for approval. Create a new version.');
            }
        });
    }

    public function agreement(): BelongsTo
    {
        return $this->belongsTo(Agreement::class);
    }

    public function acceptances(): HasMany
    {
        return $this->hasMany(AgreementAcceptance::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
