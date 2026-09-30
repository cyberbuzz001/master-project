<?php

namespace Tests\Feature;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Research\ResearchWorkflowService;
use App\Models\Client;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\ResearchReport;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Tests\TestCase;

class PortalResearchTest extends TestCase
{
    private function prepareComplianceGate(User $creator, User $verifier): void
    {
        $profile = new RegulatoryProfileVersion([
            'entity_type' => 'sebi_registered_ra',
            'legal_entity_name' => 'Expert Stocks Consultancy Pvt Ltd',
            'brand_name' => 'Expert Stocks',
            'registration_number' => 'INH000012345',
            'registration_date' => '2023-01-01',
            'registration_valid_until' => '2028-01-01',
            'ra_name' => 'Expert Stocks RA',
            'ra_contact_email' => 'ra@expertstocks.in',
            'principal_officer' => 'P. Officer',
            'compliance_officer' => 'C. Officer',
            'grievance_officer_name' => 'G. Officer',
            'grievance_officer_email' => 'grievance@expertstocks.in',
            'grievance_officer_phone' => '+919876543210',
            'public_statement' => 'SEBI Registered Research Analyst',
            'review_due_at' => now()->addMonths(6),
        ]);
        $profile->forceFill([
            'version' => 1,
            'status' => RegulatoryProfileVersion::VERIFIED,
            'verified_at' => now(),
            'created_by' => $creator->id,
            'verified_by' => $verifier->id,
        ])->save();

        foreach (ComplianceGate::REQUIRED_POLICIES as $slug) {
            $doc = PolicyDocument::firstOrCreate(['slug' => $slug], ['title' => ucfirst($slug)]);
            $content = "Published content for {$slug}";
            $v = new PolicyDocumentVersion([
                'policy_document_id' => $doc->id,
                'body_markdown' => $content,
                'content_hash' => hash('sha256', $content),
            ]);
            $v->forceFill([
                'version' => 1,
                'status' => 'published',
                'created_by' => $creator->id,
                'published_at' => now(),
            ])->save();
        }
    }

    public function test_client_portal_research_feed_and_detail(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);

        $author = $this->makeStaff('research_analyst');
        $compliance = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('research_head');
        $approver->employee->forceFill(['is_authorized_research_person' => true])->save();

        $this->prepareComplianceGate($compliance, $approver);

        // Client with active subscription and Moderate risk profile
        $clientUser = $this->makeClient(['email' => 'portalclient@example.test']);
        $client = Client::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-999',
            'full_name' => 'Portal Client User',
            'email' => $clientUser->email,
        ]);

        $q = RiskQuestionnaire::create(['code' => 'suitability', 'title' => 'Suitability']);
        $qv = new RiskQuestionnaireVersion([
            'risk_questionnaire_id' => $q->id, 'version' => 1, 'methodology_version' => 'test-1.0',
            'bands' => [['key' => 'moderate', 'label' => 'Moderate', 'min_score' => 0, 'max_score' => 100]],
        ]);
        $qv->save();

        $rp = new RiskProfile();
        $rp->forceFill([
            'client_id' => $client->id,
            'risk_questionnaire_version_id' => $qv->id,
            'risk_category' => 'MODERATE',
            'raw_score' => 50,
            'max_score' => 100,
            'methodology_version' => 'test-1.0',
            'status' => RiskProfile::FINALIZED,
            'answers_sha256' => str_repeat('c', 64),
            'finalized_at' => now(),
        ])->save();

        $service = Service::create(['code' => 'eq-res', 'name' => 'Equity Research', 'category' => 'research']);
        $plan = Plan::create(['code' => 'eq-res-m', 'service_id' => $service->id, 'name' => 'Monthly', 'billing_cycle' => 'monthly', 'duration_days' => 30]);
        $pv = new PlanVersion(['plan_id' => $plan->id, 'version' => 1, 'base_price_paise' => 100000, 'tax_code' => 'gst_18']);
        $pv->forceFill(['status' => 'published', 'published_at' => now()])->save();

        $sub = new Subscription(['client_id' => $client->id]);
        $sub->forceFill([
            'plan_version_id' => $pv->id,
            'starts_on' => now()->subDays(2)->toDateString(),
            'ends_on' => now()->addDays(28)->toDateString(),
            'status' => Subscription::ACTIVE,
        ])->save();

        // Create and publish research report
        $report = $workflow->createReport($author, [
            'title' => 'HDFC Bank Consolidation Breakout',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'HDFC Bank breaking out of range.',
            'body' => 'Comprehensive technical commentary.',
        ]);
        $version = $report->currentVersion;

        $workflow->addRecommendation($version, [
            'instrument' => 'HDFCBANK',
            'direction' => 'BUY',
            'entry_low' => 1640.0,
            'entry_high' => 1660.0,
            'stop_loss' => 1590.0,
            'targets' => [1750.0],
            'time_horizon' => '1 month',
            'risk_classification' => 'MODERATE',
        ]);

        $snapshot = $snapshotService->snapshotQuote('HDFCBANK');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        $workflow->submitForReview($author, $version->fresh());
        $workflow->complianceReview($compliance, $version->fresh(), 'CLEAR');
        $workflow->analystApprove($approver, $version->fresh(), 'Approved');
        $workflow->publish($approver, $version->fresh());

        // Authenticate as client and request research feed
        $this->actingAs($clientUser);

        $feedResponse = $this->getJson('/api/v1/client/research');
        $feedResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.active_subscription', true)
            ->assertJsonCount(1, 'data.reports')
            ->assertJsonPath('data.reports.0.title', 'HDFC Bank Consolidation Breakout');

        // Detailed view
        $uuid = $report->fresh()->uuid;
        $detailResponse = $this->getJson("/api/v1/client/research/{$uuid}");
        $detailResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.report_code', $report->report_code)
            ->assertJsonPath('data.disclosures.statutory_disclaimer', \App\Domain\Research\DisclosureEngine::STANDARD_MARKET_DISCLAIMER);

        $this->assertNotNull($detailResponse->json('data.content_hash'));
    }
}
