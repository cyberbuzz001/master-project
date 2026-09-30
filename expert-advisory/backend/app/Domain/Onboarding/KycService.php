<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\Document;
use App\Models\KycCheck;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * KYC checks are recorded against a document and verified by a person. Identity numbers are stored
 * masked, with a salted hash for duplicate detection only — never in the clear, never in the audit log.
 */
final class KycService
{
    public function __construct(private readonly AuditLogger $audit, private readonly OnboardingService $onboarding) {}

    /**
     * @return array<string, array{label: string}>
     */
    public function types(): array
    {
        return config('onboarding.kyc.types');
    }

    public function record(User $actor, Client $client, string $type, ?string $identifier = null, ?Document $document = null, ?string $remarks = null): KycCheck
    {
        $types = $this->types();

        if (! array_key_exists($type, $types)) {
            throw ApiException::unprocessable('UNKNOWN_KYC_TYPE', 'That identity check is not configured.');
        }

        $identifier = $identifier === null ? null : strtoupper(preg_replace('/\s+/', '', $identifier));
        $pattern = $types[$type]['pattern'] ?? null;

        if ($identifier !== null && $pattern !== null && preg_match($pattern, $identifier) !== 1) {
            throw ApiException::unprocessable('INVALID_IDENTIFIER', 'That '.$types[$type]['label'].' number does not look valid.', [
                'identifier' => ['Check the format and try again.'],
            ]);
        }

        $check = KycCheck::updateOrCreate(
            ['client_id' => $client->id, 'type' => $type],
            [
                'identifier_masked' => $identifier === null ? null : $this->mask($identifier, $types[$type]['mask'] ?? 'last4'),
                'identifier_hash' => $identifier === null ? null : hash_hmac('sha256', $identifier, (string) config('app.key')),
                'document_id' => $document?->id ?? null,
                'status' => KycCheck::PENDING,
                'remarks' => $remarks,
                'method' => 'manual',
            ],
        );

        $check->forceFill(['verified_by' => null, 'verified_at' => null])->save();

        // The identifier itself is deliberately not part of the audit payload.
        $this->audit->record('kyc.recorded', $check, new: ['type' => $type, 'document_id' => $check->document_id], actor: $actor);

        $this->onboarding->refreshKycStatus($client);

        return $check;
    }

    public function verify(User $actor, KycCheck $check, ?string $remarks = null): KycCheck
    {
        $this->assertVerifier($actor);

        $check->forceFill([
            'status' => KycCheck::VERIFIED,
            'remarks' => $remarks ?? $check->remarks,
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ])->save();

        $this->audit->record('kyc.verified', $check, new: ['type' => $check->type], actor: $actor);
        $this->onboarding->refreshKycStatus($check->client);

        return $check;
    }

    public function reject(User $actor, KycCheck $check, string $remarks): KycCheck
    {
        $this->assertVerifier($actor);

        if (trim($remarks) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Tell the client what is wrong with the document.');
        }

        $check->forceFill([
            'status' => KycCheck::REJECTED,
            'remarks' => $remarks,
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ])->save();

        $this->audit->record('kyc.rejected', $check, new: ['type' => $check->type], reason: $remarks, actor: $actor);
        $this->onboarding->refreshKycStatus($check->client);

        return $check;
    }

    /**
     * Other clients holding the same identity number (hash match) — a duplicate-account signal.
     *
     * @return list<Client>
     */
    public function duplicatesFor(KycCheck $check): array
    {
        if ($check->identifier_hash === null) {
            return [];
        }

        return KycCheck::query()
            ->where('identifier_hash', $check->identifier_hash)
            ->where('id', '!=', $check->id)
            ->with('client')
            ->get()
            ->pluck('client')
            ->filter()
            ->values()
            ->all();
    }

    private function assertVerifier(User $actor): void
    {
        if (! $actor->can('kyc.verify')) {
            throw ApiException::forbidden('You are not allowed to verify KYC.');
        }
    }

    private function mask(string $identifier, string $strategy): string
    {
        return match ($strategy) {
            'none' => $identifier,
            default => Str::mask($identifier, 'X', 0, max(strlen($identifier) - 4, 0)),
        };
    }
}
