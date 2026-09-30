<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\AgreementAcceptance;
use App\Models\Client;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\RiskProfile;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Onboarding state machine. A client only becomes ACTIVE when every required step is done — the
 * checklist is derived from the record, never ticked off by hand alone.
 */
final class OnboardingService
{
    public const LEAD = 'LEAD';

    public const ONBOARDING = 'ONBOARDING';

    public const ACTIVE = 'ACTIVE';

    public const ON_HOLD = 'ON_HOLD';

    public const CLOSED = 'CLOSED';

    private const TRANSITIONS = [
        self::LEAD => [self::ONBOARDING, self::CLOSED],
        self::ONBOARDING => [self::ACTIVE, self::ON_HOLD, self::CLOSED],
        self::ACTIVE => [self::ON_HOLD, self::CLOSED],
        self::ON_HOLD => [self::ONBOARDING, self::ACTIVE, self::CLOSED],
        self::CLOSED => [],
    ];

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Creates the configured checklist for a client (idempotent).
     */
    public function startChecklist(Client $client): Collection
    {
        $sort = 0;

        foreach (config('onboarding.steps') as $key => $step) {
            OnboardingStep::firstOrCreate(
                ['client_id' => $client->id, 'key' => $key],
                ['label' => $step['label'], 'is_required' => $step['required'], 'sort_order' => $sort],
            );
            $sort++;
        }

        if ($client->onboarding_status === self::LEAD) {
            $this->transition($client, self::ONBOARDING);
        }

        return $this->refresh($client);
    }

    /**
     * Recomputes every derived step from the client's actual records and returns the checklist.
     */
    public function refresh(Client $client): Collection
    {
        $steps = OnboardingStep::query()->where('client_id', $client->id)->orderBy('sort_order')->get();

        $derived = [
            'profile' => $client->email !== null || $client->mobile !== null,
            'agreements' => AgreementAcceptance::query()->where('client_id', $client->id)->exists(),
            'kyc' => $this->kycComplete($client),
            'risk_profile' => RiskProfile::query()->where('client_id', $client->id)->where('status', RiskProfile::FINALIZED)->exists(),
        ];

        foreach ($steps as $step) {
            if (! array_key_exists($step->key, $derived)) {
                continue;
            }

            $status = $derived[$step->key] ? OnboardingStep::COMPLETED : OnboardingStep::PENDING;

            if ($step->status !== $status && $step->status !== OnboardingStep::SKIPPED) {
                $step->forceFill([
                    'status' => $status,
                    'completed_at' => $status === OnboardingStep::COMPLETED ? now() : null,
                ])->save();
            }
        }

        return $steps->fresh();
    }

    /**
     * Steps a person ticks off manually (suitability sign-off, welcome pack).
     */
    public function completeStep(User $actor, Client $client, string $key, ?string $notes = null): OnboardingStep
    {
        $step = OnboardingStep::query()->where(['client_id' => $client->id, 'key' => $key])->firstOr(function () {
            throw ApiException::unprocessable('UNKNOWN_STEP', 'That onboarding step does not exist for this client.');
        });

        if (array_key_exists($key, ['profile' => 1, 'agreements' => 1, 'kyc' => 1, 'risk_profile' => 1])) {
            throw ApiException::unprocessable('DERIVED_STEP', 'This step completes on its own once the underlying record exists.');
        }

        $step->forceFill([
            'status' => OnboardingStep::COMPLETED,
            'notes' => $notes,
            'completed_by' => $actor->id,
            'completed_at' => now(),
        ])->save();

        $this->audit->record('onboarding.step_completed', $step, new: ['key' => $key], reason: $notes, actor: $actor);

        return $step;
    }

    public function skipStep(User $actor, Client $client, string $key, string $reason): OnboardingStep
    {
        $step = OnboardingStep::query()->where(['client_id' => $client->id, 'key' => $key])->firstOr(function () {
            throw ApiException::unprocessable('UNKNOWN_STEP', 'That onboarding step does not exist for this client.');
        });

        if ($step->is_required) {
            throw ApiException::unprocessable('STEP_REQUIRED', 'A required step cannot be skipped.');
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give a reason for skipping this step.');
        }

        $step->forceFill(['status' => OnboardingStep::SKIPPED, 'notes' => $reason, 'completed_by' => $actor->id, 'completed_at' => now()])->save();
        $this->audit->record('onboarding.step_skipped', $step, new: ['key' => $key], reason: $reason, actor: $actor);

        return $step;
    }

    /**
     * @return list<string> labels of required steps still outstanding
     */
    public function outstanding(Client $client): array
    {
        return $this->refresh($client)
            ->filter(fn (OnboardingStep $step) => $step->is_required && $step->status !== OnboardingStep::COMPLETED)
            ->pluck('label')
            ->values()
            ->all();
    }

    public function activate(User $actor, Client $client): Client
    {
        $outstanding = $this->outstanding($client);

        if ($outstanding !== []) {
            throw ApiException::unprocessable('ONBOARDING_INCOMPLETE', 'Onboarding is not complete yet.', [
                'steps' => $outstanding,
            ]);
        }

        $this->transition($client, self::ACTIVE, $actor);
        $client->forceFill(['onboarded_at' => $client->onboarded_at ?? now()])->save();

        return $client;
    }

    public function transition(Client $client, string $to, ?User $actor = null, ?string $reason = null): Client
    {
        $from = $client->onboarding_status;

        if ($from === $to) {
            return $client;
        }

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw ApiException::invalidTransition($from, $to);
        }

        if (in_array($to, [self::ON_HOLD, self::CLOSED], true) && trim((string) $reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give a reason for this change.');
        }

        $client->forceFill(['onboarding_status' => $to])->save();
        $this->audit->record('client.status_changed', $client, old: ['onboarding_status' => $from], new: ['onboarding_status' => $to], reason: $reason, actor: $actor);

        return $client;
    }

    public function refreshKycStatus(Client $client): Client
    {
        $checks = KycCheck::query()->where('client_id', $client->id)->get();
        $required = (array) config('onboarding.kyc.required_types');

        $status = match (true) {
            $checks->isEmpty() => 'pending',
            $checks->contains('status', KycCheck::REJECTED) => 'rejected',
            $this->kycComplete($client, $checks) => 'verified',
            default => 'in_review',
        };

        if ($client->kyc_status !== $status) {
            $client->forceFill(['kyc_status' => $status])->save();
            $this->audit->record('kyc.status_changed', $client, new: ['kyc_status' => $status, 'required' => $required]);
        }

        return $client;
    }

    private function kycComplete(Client $client, ?Collection $checks = null): bool
    {
        $checks ??= KycCheck::query()->where('client_id', $client->id)->get();
        $verified = $checks->where('status', KycCheck::VERIFIED)->pluck('type');

        foreach ((array) config('onboarding.kyc.required_types') as $type) {
            if (! $verified->contains($type)) {
                return false;
            }
        }

        return true;
    }
}
