<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Platform\RequestContext;
use App\Domain\Shared\ApiException;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\DocumentVersion;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Client documents: private disk, encrypted at rest, versioned, never served directly. Every read
 * and every issued link is logged, so who saw a KYC document and when is always answerable.
 */
final class DocumentVault
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function store(User $actor, string $ownerType, int $ownerId, string $category, UploadedFile $file, array $attributes = []): Document
    {
        $this->assertAcceptable($file);

        $categories = config('onboarding.documents.categories');

        if (! array_key_exists($category, $categories)) {
            throw ApiException::unprocessable('UNKNOWN_CATEGORY', 'That document category is not configured.');
        }

        $document = Document::query()
            ->where(['owner_type' => $ownerType, 'owner_id' => $ownerId, 'category' => $category])
            ->first();

        return DB::transaction(function () use ($actor, $ownerType, $ownerId, $category, $file, $attributes, $categories, $document): Document {
            $document ??= Document::create([
                'owner_type' => $ownerType,
                'owner_id' => $ownerId,
                'category' => $category,
                'title' => $attributes['title'] ?? $categories[$category],
                'retention_policy' => $attributes['retention_policy'] ?? config('onboarding.documents.retention.default_policy'),
                'document_expires_on' => $attributes['document_expires_on'] ?? null,
                'is_demo' => $attributes['is_demo'] ?? false,
            ]);

            $version = $this->writeVersion($actor, $document, $file);

            // A replacement always re-enters verification.
            $document->forceFill([
                'status' => Document::PENDING,
                'verified_by' => null,
                'verified_at' => null,
                'rejection_reason' => null,
            ])->save();

            $this->log($document, $version, $actor, 'uploaded');
            $this->audit->record('document.uploaded', $document, new: [
                'category' => $category, 'version' => $version->version, 'sha256' => $version->sha256, 'size' => $version->size,
            ], actor: $actor);

            return $document->refresh();
        });
    }

    public function verify(User $actor, Document $document): Document
    {
        $this->assertVerifier($actor);

        if ($document->status === Document::VERIFIED) {
            throw ApiException::unprocessable('ALREADY_VERIFIED', 'This document is already verified.');
        }

        if ($document->currentVersion() === null) {
            throw ApiException::unprocessable('NO_FILE', 'Nothing has been uploaded for this document yet.');
        }

        $document->forceFill([
            'status' => Document::VERIFIED,
            'verified_by' => $actor->id,
            'verified_at' => now(),
            'rejection_reason' => null,
            'retain_until' => $document->retain_until ?? $this->retainUntil($document),
        ])->save();

        $this->log($document, $document->currentVersion(), $actor, 'verified');
        $this->audit->record('document.verified', $document, new: ['status' => Document::VERIFIED], actor: $actor);

        return $document;
    }

    public function reject(User $actor, Document $document, string $reason): Document
    {
        $this->assertVerifier($actor);

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Tell the client why the document was rejected.');
        }

        $document->forceFill([
            'status' => Document::REJECTED,
            'rejection_reason' => $reason,
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ])->save();

        $this->log($document, $document->currentVersion(), $actor, 'rejected', $reason);
        $this->audit->record('document.rejected', $document, new: ['status' => Document::REJECTED], reason: $reason, actor: $actor);

        return $document;
    }

    /**
     * Short-lived signed link to the download route. The link itself is logged when issued.
     */
    public function temporaryUrl(User $actor, Document $document): string
    {
        $this->log($document, $document->currentVersion(), $actor, 'link_issued');

        return URL::temporarySignedRoute(
            'documents.download',
            now()->addMinutes((int) config('onboarding.documents.signed_url_ttl_minutes')),
            ['document' => $document->uuid],
        );
    }

    public function download(User $actor, Document $document): StreamedResponse
    {
        $version = $document->currentVersion();

        if ($version === null) {
            throw ApiException::unprocessable('NO_FILE', 'Nothing has been uploaded for this document yet.');
        }

        $contents = $this->contents($version);

        $this->log($document, $version, $actor, 'downloaded');
        $this->audit->record('document.downloaded', $document, new: ['version' => $version->version], actor: $actor);

        return response()->streamDownload(
            fn () => print ($contents),
            $version->original_name,
            ['Content-Type' => $version->mime, 'X-Content-Type-Options' => 'nosniff'],
        );
    }

    public function contents(DocumentVersion $version): string
    {
        $raw = Storage::disk($version->disk)->get($version->path);

        if ($raw === null) {
            throw new ApiException('FILE_MISSING', 'The stored file could not be read.', 500);
        }

        return config('onboarding.documents.encrypt_at_rest') ? Crypt::decryptString($raw) : $raw;
    }

    /**
     * Stores a generated file (a risk report PDF, a counter-signed agreement) as a document version.
     */
    public function storeGenerated(?User $actor, string $ownerType, int $ownerId, string $category, string $filename, string $contents, string $mime = 'application/pdf', array $attributes = []): Document
    {
        $document = Document::firstOrCreate(
            ['owner_type' => $ownerType, 'owner_id' => $ownerId, 'category' => $category],
            [
                'title' => $attributes['title'] ?? config("onboarding.documents.categories.{$category}", $category),
                'retention_policy' => config('onboarding.documents.retention.default_policy'),
                'is_demo' => $attributes['is_demo'] ?? false,
            ],
        );

        $version = $this->writeRaw($actor, $document, $filename, $contents, $mime);
        $this->log($document, $version, $actor, 'uploaded', 'generated by the platform');

        return $document->refresh();
    }

    private function writeVersion(User $actor, Document $document, UploadedFile $file): DocumentVersion
    {
        return $this->writeRaw(
            $actor,
            $document,
            $file->getClientOriginalName() ?: 'document',
            (string) file_get_contents($file->getRealPath()),
            $file->getMimeType() ?: 'application/octet-stream',
        );
    }

    private function writeRaw(?User $actor, Document $document, string $originalName, string $contents, string $mime): DocumentVersion
    {
        $disk = config('onboarding.documents.disk');
        $next = ((int) $document->versions()->max('version')) + 1;
        $path = sprintf('documents/%s/%s/v%d-%s', $document->owner_type, $document->uuid, $next, Str::random(16));

        Storage::disk($disk)->put($path, config('onboarding.documents.encrypt_at_rest') ? Crypt::encryptString($contents) : $contents);

        return DocumentVersion::create([
            'document_id' => $document->id,
            'version' => $next,
            'disk' => $disk,
            'path' => $path,
            'original_name' => Str::limit(basename($originalName), 250, ''),
            'mime' => $mime,
            'size' => strlen($contents),
            'sha256' => hash('sha256', $contents),
            'scan_status' => 'skipped',
            'uploaded_by' => $actor?->id,
        ]);
    }

    private function assertAcceptable(UploadedFile $file): void
    {
        if (! $file->isValid()) {
            throw ApiException::unprocessable('UPLOAD_FAILED', 'The file could not be uploaded.');
        }

        $maxBytes = (int) config('onboarding.documents.max_size_kb') * 1024;

        if ($file->getSize() > $maxBytes) {
            throw ApiException::unprocessable('FILE_TOO_LARGE', 'The file is larger than the configured limit.');
        }

        if (! in_array($file->getMimeType(), config('onboarding.documents.allowed_mimes'), true)) {
            throw ApiException::unprocessable('UNSUPPORTED_FILE_TYPE', 'Upload a PDF or an image.');
        }
    }

    private function assertVerifier(User $actor): void
    {
        if (! $actor->can('kyc.verify')) {
            throw ApiException::forbidden('You are not allowed to verify documents.');
        }
    }

    private function retainUntil(Document $document): ?string
    {
        $years = config("onboarding.documents.retention.policies.{$document->retention_policy}.years");

        return $years === null ? null : now()->addYears((int) $years)->toDateString();
    }

    private function log(Document $document, ?DocumentVersion $version, ?User $actor, string $action, ?string $context = null): void
    {
        DocumentAccessLog::create([
            'document_id' => $document->id,
            'document_version_id' => $version?->id,
            'user_id' => $actor?->id,
            'action' => $action,
            'ip' => RequestContext::ip(),
            'request_id' => RequestContext::requestId(),
            'context' => $context,
        ]);
    }
}
