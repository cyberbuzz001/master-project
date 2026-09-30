<?php

namespace App\Domain\Compliance;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class PolicyDocumentService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{body_markdown: string, change_summary?: ?string, effective_from?: ?string, review_due_at?: ?string, source_url?: ?string}  $data
     */
    public function createDraft(User $actor, PolicyDocument $document, array $data): PolicyDocumentVersion
    {
        return DB::transaction(function () use ($actor, $document, $data): PolicyDocumentVersion {
            $next = (int) PolicyDocumentVersion::query()->where('policy_document_id', $document->id)->lockForUpdate()->max('version') + 1;

            $version = PolicyDocumentVersion::create([
                'policy_document_id' => $document->id,
                'version' => $next,
                'body_markdown' => $data['body_markdown'],
                'content_hash' => hash('sha256', $data['body_markdown']),
                'change_summary' => $data['change_summary'] ?? null,
                'effective_from' => $data['effective_from'] ?? null,
                'review_due_at' => $data['review_due_at'] ?? null,
                'source_url' => $data['source_url'] ?? null,
                'created_by' => $actor->id,
            ]);

            $this->audit->record('policy.draft_created', $version, new: [
                'slug' => $document->slug, 'version' => $next, 'content_hash' => $version->content_hash,
            ]);

            return $version;
        });
    }

    public function approve(User $actor, PolicyDocumentVersion $version): PolicyDocumentVersion
    {
        if ($version->status !== PolicyDocumentVersion::DRAFT) {
            throw ApiException::invalidTransition($version->status, PolicyDocumentVersion::APPROVED);
        }

        if ($version->created_by === $actor->id) {
            throw ApiException::forbidden('A policy version must be approved by someone other than its author.', 'SEPARATION_OF_DUTIES');
        }

        $version->forceFill(['status' => PolicyDocumentVersion::APPROVED, 'approved_by' => $actor->id, 'approved_at' => now()])->save();
        $this->audit->record('policy.approved', $version, ['status' => PolicyDocumentVersion::DRAFT], ['status' => PolicyDocumentVersion::APPROVED]);

        return $version;
    }

    public function publish(User $actor, PolicyDocumentVersion $version): PolicyDocumentVersion
    {
        if ($version->status !== PolicyDocumentVersion::APPROVED) {
            throw ApiException::invalidTransition($version->status, PolicyDocumentVersion::PUBLISHED);
        }

        return DB::transaction(function () use ($actor, $version): PolicyDocumentVersion {
            $previous = PolicyDocumentVersion::query()
                ->where('policy_document_id', $version->policy_document_id)
                ->where('status', PolicyDocumentVersion::PUBLISHED)
                ->get();

            foreach ($previous as $old) {
                $old->forceFill(['status' => PolicyDocumentVersion::SUPERSEDED, 'superseded_at' => now()])->save();
                $this->audit->record('policy.superseded', $old, ['status' => PolicyDocumentVersion::PUBLISHED], ['status' => PolicyDocumentVersion::SUPERSEDED]);
            }

            $version->forceFill([
                'status' => PolicyDocumentVersion::PUBLISHED,
                'published_by' => $actor->id,
                'published_at' => now(),
                'effective_from' => $version->effective_from ?? now()->toDateString(),
            ])->save();

            $this->audit->record('policy.published', $version, ['status' => PolicyDocumentVersion::APPROVED], ['status' => PolicyDocumentVersion::PUBLISHED]);

            return $version;
        });
    }
}
