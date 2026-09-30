<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['policy_document_id', 'version', 'body_markdown', 'content_hash', 'change_summary', 'effective_from', 'review_due_at', 'source_url', 'created_by'])]
class PolicyDocumentVersion extends Model
{
    public const DRAFT = 'draft';

    public const APPROVED = 'approved';

    public const PUBLISHED = 'published';

    public const SUPERSEDED = 'superseded';

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'review_due_at' => 'date',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Content of an approved or published version never changes; only lifecycle fields may.
        static::updating(function (PolicyDocumentVersion $version): void {
            if ($version->getOriginal('status') !== self::DRAFT
                && $version->isDirty(['body_markdown', 'content_hash', 'version', 'policy_document_id'])) {
                throw new LogicException('Approved policy versions are immutable. Create a new version.');
            }
        });

        static::deleting(function (PolicyDocumentVersion $version): void {
            if ($version->status !== self::DRAFT) {
                throw new LogicException('Only draft policy versions can be deleted.');
            }
        });
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(PolicyDocument::class, 'policy_document_id');
    }
}
