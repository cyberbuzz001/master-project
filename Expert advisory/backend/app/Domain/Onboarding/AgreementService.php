<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Platform\RequestContext;
use App\Domain\Shared\ApiException;
use App\Models\Agreement;
use App\Models\AgreementAcceptance;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Client agreements are versioned and approved by a second person before a client can accept one;
 * acceptances are append-only evidence (who, when, from where, against which exact text).
 */
final class AgreementService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ConsentRecorder $consents,
        private readonly OnboardingService $onboarding,
    ) {}

    public function draft(User $actor, Agreement $agreement, string $bodyMarkdown, ?string $effectiveFrom = null): AgreementVersion
    {
        $this->assertManager($actor);

        $next = ((int) $agreement->versions()->max('version')) + 1;

        $version = AgreementVersion::create([
            'agreement_id' => $agreement->id,
            'version' => $next,
            'body_markdown' => $bodyMarkdown,
            'effective_from' => $effectiveFrom,
            'created_by' => $actor->id,
        ]);

        $this->audit->record('agreement.drafted', $version, new: ['version' => $next], actor: $actor);

        return $version;
    }

    public function submitForApproval(User $actor, AgreementVersion $version): AgreementVersion
    {
        $this->assertManager($actor);

        if ($version->status !== AgreementVersion::DRAFT) {
            throw ApiException::invalidTransition($version->status, AgreementVersion::IN_REVIEW);
        }

        $version->forceFill(['status' => AgreementVersion::IN_REVIEW])->save();
        $this->audit->record('agreement.submitted', $version, actor: $actor);

        return $version;
    }

    /**
     * Separation of duties: the author cannot approve their own agreement text.
     */
    public function approve(User $actor, AgreementVersion $version): AgreementVersion
    {
        if (! $actor->can('policies.approve')) {
            throw ApiException::forbidden('You are not allowed to approve agreements.');
        }

        if ($version->status !== AgreementVersion::IN_REVIEW) {
            throw ApiException::invalidTransition($version->status, 'approved');
        }

        if ($version->created_by === $actor->id) {
            throw ApiException::forbidden('An agreement must be approved by someone other than its author.', 'SEPARATION_OF_DUTIES');
        }

        $version->forceFill(['approved_by' => $actor->id, 'approved_at' => now()])->save();
        $this->audit->record('agreement.approved', $version, actor: $actor);

        return $version;
    }

    public function publish(User $actor, AgreementVersion $version): AgreementVersion
    {
        if (! $actor->can('policies.publish')) {
            throw ApiException::forbidden('You are not allowed to publish agreements.');
        }

        if ($version->approved_at === null) {
            throw ApiException::unprocessable('NOT_APPROVED', 'The agreement must be approved before it is published.');
        }

        return DB::transaction(function () use ($actor, $version): AgreementVersion {
            AgreementVersion::query()
                ->where('agreement_id', $version->agreement_id)
                ->where('status', AgreementVersion::PUBLISHED)
                ->each(fn (AgreementVersion $current) => $current->forceFill(['status' => AgreementVersion::RETIRED])->save());

            $version->forceFill([
                'status' => AgreementVersion::PUBLISHED,
                'published_at' => now(),
                'effective_from' => $version->effective_from ?? now()->toDateString(),
            ])->save();

            $this->audit->record('agreement.published', $version, new: ['version' => $version->version], actor: $actor);

            return $version;
        });
    }

    /**
     * Records acceptance of the currently published version and the matching consent record.
     */
    public function accept(Client $client, AgreementVersion $version, string $method = 'portal', ?User $acceptedBy = null, ?User $recordedBy = null, ?Document $document = null): AgreementAcceptance
    {
        if ($version->status !== AgreementVersion::PUBLISHED) {
            throw ApiException::unprocessable('AGREEMENT_NOT_PUBLISHED', 'Only a published agreement version can be accepted.');
        }

        if (! in_array($method, ['portal', 'counter_signed', 'offline'], true)) {
            throw ApiException::unprocessable('UNKNOWN_METHOD', 'Unknown acceptance method.');
        }

        if ($method !== 'portal' && $document === null) {
            throw ApiException::unprocessable('EVIDENCE_REQUIRED', 'Attach the signed copy when recording an offline acceptance.');
        }

        $existing = AgreementAcceptance::query()
            ->where(['client_id' => $client->id, 'agreement_version_id' => $version->id])
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return DB::transaction(function () use ($client, $version, $method, $acceptedBy, $recordedBy, $document): AgreementAcceptance {
            $acceptance = new AgreementAcceptance;
            $acceptance->forceFill([
                'client_id' => $client->id,
                'agreement_version_id' => $version->id,
                'method' => $method,
                'accepted_by_user_id' => $acceptedBy?->id,
                'recorded_by' => $recordedBy?->id,
                'document_id' => $document?->id,
                'ip' => RequestContext::ip(),
                'user_agent' => RequestContext::userAgent(),
                'evidence_sha256' => hash('sha256', implode('|', [
                    $client->uuid, $version->body_sha256, $method, now()->toIso8601String(),
                ])),
                'accepted_at' => now(),
            ])->save();

            $this->consents->record(
                subjectType: 'client',
                subjectId: $client->id,
                purpose: 'client_agreement',
                granted: true,
                channel: $method === 'portal' ? 'portal' : 'offline',
                consentText: sprintf('Accepted %s v%d (sha256 %s).', $version->agreement->title, $version->version, $version->body_sha256),
                isDemo: (bool) $client->is_demo,
            );

            $this->audit->record('agreement.accepted', $acceptance, new: [
                'agreement' => $version->agreement->code, 'version' => $version->version, 'method' => $method,
            ], actor: $recordedBy ?? $acceptedBy);

            $this->onboarding->refresh($client);

            return $acceptance;
        });
    }

    /**
     * Published agreement versions a client has not accepted yet.
     *
     * @return list<AgreementVersion>
     */
    public function outstandingFor(Client $client): array
    {
        $accepted = AgreementAcceptance::query()->where('client_id', $client->id)->pluck('agreement_version_id');

        return AgreementVersion::query()
            ->where('status', AgreementVersion::PUBLISHED)
            ->whereNotIn('id', $accepted)
            ->whereHas('agreement', fn ($query) => $query->where('is_active', true)->where('requires_client_acceptance', true))
            ->with('agreement')
            ->get()
            ->all();
    }

    private function assertManager(User $actor): void
    {
        if (! $actor->can('policies.edit')) {
            throw ApiException::forbidden('You are not allowed to edit agreements.');
        }
    }
}
