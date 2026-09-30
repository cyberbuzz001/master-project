<?php

namespace App\Domain\Research;

use App\Domain\MarketData\MarketDataManager;
use App\Models\ResearchPerformance;
use App\Models\ResearchRecommendation;
use App\Models\ResearchVersion;
use Carbon\CarbonImmutable;

class PerformanceLedgerService
{
    public function __construct(protected MarketDataManager $marketData) {}

    /**
     * Initialize performance ledger entries for all recommendations in a published version.
     */
    public function initializeTracking(ResearchVersion $version): void
    {
        $publishedAt = $version->published_at ?? CarbonImmutable::now();

        foreach ($version->recommendations as $rec) {
            if ($rec->performance !== null) {
                continue;
            }

            ResearchPerformance::create([
                'recommendation_id' => $rec->id,
                'published_at' => $publishedAt,
                'entry_ref' => $rec->entryReference(),
                'high_after' => $rec->entryReference(),
                'low_after' => $rec->entryReference(),
                'close_ref' => $rec->entryReference(),
                'mfe' => 0.0,
                'mae' => 0.0,
                'outcome' => ResearchPerformance::OUTCOME_PENDING,
                'methodology_version' => 'v1.0',
                'computed_at' => $publishedAt,
            ]);
        }
    }

    /**
     * Track and update performance against latest market data.
     *
     * @return int Number of evaluated recommendations
     */
    public function trackPerformance(): int
    {
        $activeRecs = ResearchRecommendation::query()
            ->where('status', ResearchRecommendation::STATUS_ACTIVE)
            ->whereHas('version', fn ($q) => $q->where('status', ResearchVersion::STATUS_PUBLISHED))
            ->with(['performance', 'version'])
            ->get();

        $count = 0;
        $now = CarbonImmutable::now();

        foreach ($activeRecs as $rec) {
            $perf = $rec->performance;
            if ($perf === null) {
                $this->initializeTracking($rec->version);
                $perf = $rec->fresh()->performance;
            }

            try {
                $quote = $this->marketData->provider()->fetchQuote($rec->instrument, $rec->exchange);
            } catch (\Throwable) {
                continue;
            }

            $entryRef = (float) $perf->entry_ref;
            $currentHigh = max((float) $perf->high_after, (float) $quote->high);
            $currentLow = min((float) $perf->low_after, (float) $quote->low);
            $currentClose = (float) $quote->close;

            $targets = is_array($rec->targets) ? $rec->targets : [];
            $target1 = ! empty($targets) ? (float) $targets[0] : 0.0;
            $stopLoss = (float) $rec->stop_loss;

            $outcome = ResearchPerformance::OUTCOME_PENDING;
            $recStatus = ResearchRecommendation::STATUS_ACTIVE;

            if ($rec->direction === ResearchRecommendation::DIRECTION_BUY || $rec->direction === ResearchRecommendation::DIRECTION_ACCUMULATE) {
                // MFE is high gain, MAE is low loss
                $mfe = round((($currentHigh - $entryRef) / $entryRef) * 100, 4);
                $mae = round((($entryRef - $currentLow) / $entryRef) * 100, 4);

                if ($target1 > 0 && $currentHigh >= $target1) {
                    $outcome = ResearchPerformance::OUTCOME_TARGET_HIT;
                    $recStatus = ResearchRecommendation::STATUS_TARGET_HIT;
                } elseif ($stopLoss > 0 && $currentLow <= $stopLoss) {
                    $outcome = ResearchPerformance::OUTCOME_STOP_LOSS_HIT;
                    $recStatus = ResearchRecommendation::STATUS_STOP_LOSS_HIT;
                }
            } else {
                // Short / Sell
                $mfe = round((($entryRef - $currentLow) / $entryRef) * 100, 4);
                $mae = round((($currentHigh - $entryRef) / $entryRef) * 100, 4);

                if ($target1 > 0 && $currentLow <= $target1) {
                    $outcome = ResearchPerformance::OUTCOME_TARGET_HIT;
                    $recStatus = ResearchRecommendation::STATUS_TARGET_HIT;
                } elseif ($stopLoss > 0 && $currentHigh >= $stopLoss) {
                    $outcome = ResearchPerformance::OUTCOME_STOP_LOSS_HIT;
                    $recStatus = ResearchRecommendation::STATUS_STOP_LOSS_HIT;
                }
            }

            // Check expiration if version has valid_until
            if ($recStatus === ResearchRecommendation::STATUS_ACTIVE && $rec->version->valid_until !== null && $rec->version->valid_until->isPast()) {
                $outcome = ResearchPerformance::OUTCOME_EXPIRED;
                $recStatus = ResearchRecommendation::STATUS_EXPIRED;
            }

            $perf->update([
                'high_after' => $currentHigh,
                'low_after' => $currentLow,
                'close_ref' => $currentClose,
                'mfe' => $mfe,
                'mae' => $mae,
                'outcome' => $outcome,
                'computed_at' => $now,
            ]);

            if ($recStatus !== ResearchRecommendation::STATUS_ACTIVE) {
                $rec->update(['status' => $recStatus]);
            }

            $count++;
        }

        return $count;
    }
}
