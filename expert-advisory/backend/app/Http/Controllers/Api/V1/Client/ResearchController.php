<?php

namespace App\Http\Controllers\Api\V1\Client;

use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Client;
use App\Models\ResearchDistribution;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ResearchController extends Controller
{
    /**
     * Client research desk feed.
     */
    public function index(Request $request): JsonResponse
    {
        $client = $this->client($request);

        // Verify client has an active subscription
        $hasActiveSub = Subscription::query()
            ->where('client_id', $client->id)
            ->where('status', Subscription::ACTIVE)
            ->where(function ($q) {
                $q->whereNull('ends_on')->orWhere('ends_on', '>=', now()->toDateString());
            })
            ->exists();

        if (! $hasActiveSub) {
            return ApiResponse::success([
                'active_subscription' => false,
                'reports' => [],
                'message' => 'An active advisory subscription is required to access research recommendations.',
            ]);
        }

        // Query published research reports distributed to this client
        $distributions = ResearchDistribution::query()
            ->where('client_id', $client->id)
            ->where('delivery_status', ResearchDistribution::STATUS_DELIVERED)
            ->with([
                'version.report',
                'version.author.user:id,name',
                'version.recommendations',
            ])
            ->latest('id')
            ->limit(50)
            ->get();

        $reports = $distributions->map(function (ResearchDistribution $dist) {
            $version = $dist->version;
            $report = $version?->report;

            return [
                'uuid' => $report?->uuid,
                'report_code' => $report?->report_code,
                'title' => $version?->title,
                'summary' => $version?->summary,
                'report_type' => $report?->report_type,
                'category' => $report?->category,
                'published_at' => $version?->published_at?->toIso8601String(),
                'valid_until' => $version?->valid_until?->toIso8601String(),
                'author' => $version?->author?->user?->name,
                'recommendations' => $version?->recommendations->map(fn ($r) => [
                    'id' => $r->id,
                    'instrument' => $r->instrument,
                    'exchange' => $r->exchange,
                    'segment' => $r->segment,
                    'direction' => $r->direction,
                    'entry_low' => (float) $r->entry_low,
                    'entry_high' => (float) $r->entry_high,
                    'stop_loss' => (float) $r->stop_loss,
                    'targets' => $r->targets,
                    'time_horizon' => $r->time_horizon,
                    'risk_classification' => $r->risk_classification,
                    'status' => $r->status,
                ])->all(),
            ];
        })->filter(fn ($r) => $r['uuid'] !== null)->values();

        return ApiResponse::success([
            'active_subscription' => true,
            'reports' => $reports,
        ]);
    }

    /**
     * Detailed view of a published research report.
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $client = $this->client($request);

        $report = ResearchReport::query()
            ->where('uuid', $uuid)
            ->with([
                'currentVersion.author.user:id,name',
                'currentVersion.approver:id,name',
                'currentVersion.recommendations.performance',
                'currentVersion.disclosureBinding',
            ])
            ->firstOrFail();

        $version = $report->currentVersion;
        if ($version === null || $version->status !== ResearchVersion::STATUS_PUBLISHED) {
            throw ApiException::notFound('Research report not found or not published.');
        }

        // Verify client was delivered this report
        $delivered = ResearchDistribution::query()
            ->where('client_id', $client->id)
            ->where('research_version_id', $version->id)
            ->where('delivery_status', ResearchDistribution::STATUS_DELIVERED)
            ->exists();

        if (! $delivered) {
            throw ApiException::forbidden('This research report is not available for your current risk suitability profile or subscription tier.');
        }

        return ApiResponse::success([
            'uuid' => $report->uuid,
            'report_code' => $report->report_code,
            'title' => $version->title,
            'summary' => $version->summary,
            'body' => $version->body,
            'sections' => $version->sections,
            'report_type' => $report->report_type,
            'category' => $report->category,
            'published_at' => $version->published_at?->toIso8601String(),
            'valid_until' => $version->valid_until?->toIso8601String(),
            'author' => $version->author?->user?->name,
            'approver' => $version->approver?->name,
            'content_hash' => $version->content_hash,
            'disclosure_set_hash' => $version->disclosure_set_hash,
            'disclosures' => $version->disclosureBinding?->disclosures,
            'recommendations' => $version->recommendations->map(fn ($r) => [
                'id' => $r->id,
                'instrument' => $r->instrument,
                'exchange' => $r->exchange,
                'segment' => $r->segment,
                'direction' => $r->direction,
                'entry_low' => (float) $r->entry_low,
                'entry_high' => (float) $r->entry_high,
                'stop_loss' => (float) $r->stop_loss,
                'targets' => $r->targets,
                'time_horizon' => $r->time_horizon,
                'risk_classification' => $r->risk_classification,
                'status' => $r->status,
                'performance' => $r->performance ? [
                    'entry_ref' => (float) $r->performance->entry_ref,
                    'high_after' => (float) $r->performance->high_after,
                    'low_after' => (float) $r->performance->low_after,
                    'mfe' => (float) $r->performance->mfe,
                    'mae' => (float) $r->performance->mae,
                    'outcome' => $r->performance->outcome,
                ] : null,
            ])->all(),
        ]);
    }

    private function client(Request $request): Client
    {
        $client = $request->user()->client;

        if ($client === null) {
            throw ApiException::unprocessable('NO_CLIENT_RECORD', 'Your client record is still being set up.');
        }

        return $client;
    }
}
