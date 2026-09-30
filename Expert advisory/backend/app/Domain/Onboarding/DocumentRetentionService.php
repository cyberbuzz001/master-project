<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Platform\Settings;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\DocumentVersion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;

/**
 * Retention housekeeping. Expiry (an ID that has run out) is marked automatically; destroying a file
 * past its retention date is not — it needs `documents.auto_purge` to be turned on deliberately,
 * because deleting client records early can be worse than keeping them too long. Metadata, hashes
 * and the access log always survive a purge so the history stays answerable.
 */
final class DocumentRetentionService
{
    public function __construct(private readonly AuditLogger $audit, private readonly Settings $settings) {}

    /**
     * @return array{expired: int, purged: int, due: int}
     */
    public function sweep(): array
    {
        return [
            'expired' => $this->markExpired(),
            'purged' => $this->settings->get('documents.auto_purge', false) ? $this->purgeDue() : 0,
            'due' => $this->due()->count(),
        ];
    }

    /**
     * Documents whose own validity date has passed (an expired PAN card, an out-of-date address proof).
     */
    public function markExpired(): int
    {
        $count = 0;

        Document::query()
            ->withoutGlobalScopes()
            ->whereNotNull('document_expires_on')
            ->whereDate('document_expires_on', '<', now())
            ->whereIn('status', [Document::PENDING, Document::VERIFIED])
            ->chunkById(200, function ($documents) use (&$count): void {
                foreach ($documents as $document) {
                    $document->forceFill(['status' => Document::EXPIRED])->save();
                    $this->audit->record('document.expired', $document, new: ['status' => Document::EXPIRED]);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * Documents past their retention date, oldest first.
     */
    public function due(): Builder
    {
        return Document::query()
            ->withoutGlobalScopes()
            ->whereNotNull('retain_until')
            ->whereDate('retain_until', '<', now())
            ->whereHas('versions')
            ->orderBy('retain_until');
    }

    /**
     * Deletes the stored bytes, keeps the record. The document is soft-deleted so it disappears from
     * the UI while the trail (who uploaded it, who saw it, its hash) remains.
     */
    public function purgeDue(): int
    {
        $count = 0;

        $this->due()->chunkById(100, function ($documents) use (&$count): void {
            foreach ($documents as $document) {
                $this->purge($document);
                $count++;
            }
        }, 'id');

        return $count;
    }

    public function purge(Document $document): Document
    {
        $versions = $document->versions()->get();

        foreach ($versions as $version) {
            if ($this->fileExists($version)) {
                Storage::disk($version->disk)->delete($version->path);
            }
        }

        DocumentAccessLog::create([
            'document_id' => $document->id,
            'user_id' => null,
            'action' => 'purged',
            'context' => 'retention period ended on '.$document->retain_until?->toDateString(),
        ]);

        $this->audit->record('document.purged', $document, new: [
            'versions' => $versions->count(),
            'retain_until' => $document->retain_until?->toDateString(),
        ]);

        $document->delete();

        return $document;
    }

    private function fileExists(DocumentVersion $version): bool
    {
        return Storage::disk($version->disk)->exists($version->path);
    }
}
