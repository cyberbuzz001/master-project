<?php

namespace App\Domain\Research;

use App\Domain\Crm\AutomationWorkflowEngine;
use App\Models\Client;
use App\Models\ResearchDistribution;
use App\Models\ResearchVersion;

class ResearchDistributionService
{
    public function __construct(private ResearchAccessService $access) {}

    public function distribute(ResearchVersion $version): array
    {
        $distributed = 0;
        $skipped = 0;
        $version->loadMissing(['recommendations', 'report']);
        foreach (Client::query()->lazyById(200) as $client) {
            $reason = $this->access->denialReason($client, $version);
            $entry = ResearchDistribution::firstOrCreate([
                'research_version_id' => $version->id, 'client_id' => $client->id, 'channel' => ResearchDistribution::CHANNEL_PORTAL,
            ], ['sent_at' => $reason ? null : now(), 'delivery_status' => $reason ? ResearchDistribution::STATUS_SKIPPED_SUITABILITY : ResearchDistribution::STATUS_DELIVERED, 'skip_reason' => $reason]);
            if (! $reason && $version->whatsapp_template_key && $client->lead_id && $client->lead) {
                app(AutomationWorkflowEngine::class)->scheduleAction($client->lead, null, 'send_research_notification', [
                    'research_version_id' => $version->id, 'client_id' => $client->id,
                ]);
            }
            if ($entry->wasRecentlyCreated) {
                if ($reason) {
                    $skipped++;
                } else {
                    $distributed++;
                }
            }
        }

        return ['distributed' => $distributed, 'skipped' => $skipped];
    }
}
