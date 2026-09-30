<?php

namespace App\Domain\Research;

use App\Models\Client;
use App\Models\ResearchDistribution;
use App\Models\ResearchVersion;
use Carbon\CarbonImmutable;

class ResearchDistributionService
{
    private const RISK_RANKS = [
        'LOW' => 1,
        'CONSERVATIVE' => 1,
        'MODERATE' => 2,
        'BALANCED' => 2,
        'HIGH' => 3,
        'GROWTH' => 3,
        'AGGRESSIVE' => 3,
        'VERY_HIGH' => 4,
        'VERY_AGGRESSIVE' => 4,
        'SPECULATIVE' => 4,
    ];

    /**
     * Resolve audience, apply suitability filters, and record distribution entries.
     *
     * @return array{distributed: int, skipped: int}
     */
    public function distribute(ResearchVersion $version): array
    {
        // 1. Resolve candidate clients who have active subscriptions
        $clients = Client::query()
            ->whereHas('subscriptions', fn ($q) => $q->where('status', \App\Models\Subscription::ACTIVE)->where(function ($subQ) {
                $subQ->whereNull('ends_on')->orWhere('ends_on', '>=', now()->toDateString());
            }))
            ->with(['riskProfiles' => fn ($q) => $q->where('status', 'finalized')->latest('id')])
            ->get();

        // Highest risk in this research version's recommendations
        $maxRecRiskRank = 1;
        $maxRecRiskName = 'LOW';
        foreach ($version->recommendations as $rec) {
            $rank = self::RISK_RANKS[strtoupper($rec->risk_classification)] ?? 2;
            if ($rank > $maxRecRiskRank) {
                $maxRecRiskRank = $rank;
                $maxRecRiskName = strtoupper($rec->risk_classification);
            }
        }

        $distributedCount = 0;
        $skippedCount = 0;
        $now = CarbonImmutable::now();

        foreach ($clients as $client) {
            $riskProfile = $client->riskProfiles->first();
            $clientCategory = $riskProfile ? strtoupper($riskProfile->risk_category) : 'MODERATE';
            $clientRank = self::RISK_RANKS[$clientCategory] ?? 2;

            // Suitability Gate
            if ($maxRecRiskRank > $clientRank) {
                ResearchDistribution::create([
                    'research_version_id' => $version->id,
                    'client_id' => $client->id,
                    'channel' => ResearchDistribution::CHANNEL_PORTAL,
                    'sent_at' => null,
                    'delivery_status' => ResearchDistribution::STATUS_SKIPPED_SUITABILITY,
                    'skip_reason' => "Recommendation risk ({$maxRecRiskName}) exceeds client assessed risk profile ({$clientCategory}).",
                ]);
                $skippedCount++;
                continue;
            }

            // Client passed suitability - record Portal feed delivery
            ResearchDistribution::create([
                'research_version_id' => $version->id,
                'client_id' => $client->id,
                'channel' => ResearchDistribution::CHANNEL_PORTAL,
                'sent_at' => $now,
                'delivery_status' => ResearchDistribution::STATUS_DELIVERED,
                'skip_reason' => null,
            ]);
            $distributedCount++;
        }

        return [
            'distributed' => $distributedCount,
            'skipped' => $skippedCount,
        ];
    }
}
