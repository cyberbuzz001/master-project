<?php

namespace App\Domain\Compliance;

use App\Domain\Platform\RequestContext;
use App\Models\ConsentRecord;
use App\Models\PolicyDocument;
use InvalidArgumentException;

final class ConsentRecorder
{
    public function record(
        string $subjectType,
        int $subjectId,
        string $purpose,
        bool $granted,
        string $channel,
        string $consentText,
        ?string $policySlug = null,
        bool $isDemo = false,
    ): ConsentRecord {
        if (! in_array($purpose, ConsentRecord::PURPOSES, true)) {
            throw new InvalidArgumentException("Unknown consent purpose [{$purpose}].");
        }

        $policyVersionId = $policySlug === null
            ? null
            : PolicyDocument::query()->where('slug', $policySlug)->first()?->publishedVersion?->id;

        return ConsentRecord::create([
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'purpose' => $purpose,
            'granted' => $granted,
            'channel' => $channel,
            'policy_document_version_id' => $policyVersionId,
            'consent_text' => $consentText,
            'consent_text_hash' => hash('sha256', $consentText),
            'ip' => RequestContext::ip(),
            'user_agent' => RequestContext::userAgent(),
            'request_id' => RequestContext::requestId(),
            'is_demo' => $isDemo,
            'captured_at' => now(),
        ]);
    }

    public function hasConsent(string $subjectType, int $subjectId, string $purpose): bool
    {
        $latest = ConsentRecord::query()
            ->where(['subject_type' => $subjectType, 'subject_id' => $subjectId, 'purpose' => $purpose])
            ->orderByDesc('captured_at')
            ->orderByDesc('id')
            ->first();

        return (bool) $latest?->granted;
    }
}
