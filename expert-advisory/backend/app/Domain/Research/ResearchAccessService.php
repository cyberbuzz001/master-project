<?php

namespace App\Domain\Research;

use App\Models\Client;
use App\Models\FreeTrial;
use App\Models\ResearchVersion;
use App\Models\RiskProfile;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Builder;

class ResearchAccessService
{
    private const RISK_RANKS = ['LOW' => 1, 'CONSERVATIVE' => 1, 'MODERATE' => 2, 'BALANCED' => 2, 'HIGH' => 3, 'GROWTH' => 3, 'AGGRESSIVE' => 3, 'VERY_HIGH' => 4, 'VERY_AGGRESSIVE' => 4, 'SPECULATIVE' => 4];

    public function hasActiveSubscription(Client $client): bool
    {
        return $this->activeSubscriptions($client)->exists();
    }

    private function activeSubscriptions(Client $client): Builder
    {
        $today = now('Asia/Kolkata')->toDateString();

        return Subscription::where('client_id', $client->id)->where('status', Subscription::ACTIVE)
            ->whereNotNull('starts_on')->whereDate('starts_on', '<=', $today)
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhereDate('ends_on', '>=', $today));
    }

    public function denialReason(Client $client, ResearchVersion $version): ?string
    {
        if ($version->status !== ResearchVersion::STATUS_PUBLISHED || ! $version->published_at || $version->published_at->isFuture() || ($version->valid_until && $version->valid_until->isPast()) || $version->report?->archive_status !== 'active') {
            return 'Research is unpublished, archived, or expired.';
        }
        if (in_array($client->onboarding_status, ['CLOSED', 'ON_HOLD'], true) || ! $client->user?->isActive()) {
            return 'Client account is unavailable or on hold.';
        }
        $services = $version->eligible_service_ids ?? [];
        $paid = $services && $this->activeSubscriptions($client)->whereHas('planVersion.plan', fn ($q) => $q->whereIn('service_id', $services))->exists();
        $trial = false;
        if ($version->eligible_trial_types) {
            $today = now('Asia/Kolkata')->toDateString();
            $trial = FreeTrial::where('status', 'active')->whereNotNull('approved_at')->whereIn('trial_type', $version->eligible_trial_types)
                ->whereDate('start_date', '<=', $today)->whereDate('end_date', '>=', $today)
                ->where(fn ($q) => $q->where('client_id', $client->id)->when($client->lead_id, fn ($q) => $q->orWhere('lead_id', $client->lead_id)))->exists();
        }
        if (! $paid && ! $trial) {
            return 'No current entitlement for the selected research service or trial.';
        }
        if ($version->recommendations->isEmpty()) {
            return null;
        }
        if ($client->onboarding_status !== 'ACTIVE' || $client->kyc_status !== 'verified') {
            return 'Verified onboarding is required for recommendations.';
        }
        $profile = $client->riskProfiles()->where('status', RiskProfile::FINALIZED)->latest('id')->first();
        $rank = $profile && ! $profile->isExpired() && $profile->finalized_at && $profile->acknowledged_at ? (self::RISK_RANKS[strtoupper($profile->risk_category ?? '')] ?? null) : null;
        if ($rank === null) {
            return 'A current finalized risk assessment is required.';
        }
        foreach ($version->recommendations as $recommendation) {
            $required = self::RISK_RANKS[strtoupper($recommendation->risk_classification ?? '')] ?? null;
            if ($required === null || $required > $rank) {
                return 'Recommendation risk exceeds the current assessed risk profile.';
            }
        }

        return null;
    }
}
