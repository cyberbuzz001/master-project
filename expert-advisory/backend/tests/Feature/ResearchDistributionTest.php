<?php

namespace Tests\Feature;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Research\ResearchDistributionService;
use App\Domain\Research\ResearchWorkflowService;
use App\Models\Client;
use App\Models\Plan;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\ResearchDistribution;
use App\Models\ResearchReport;
use App\Models\RiskProfile;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Tests\TestCase;

class ResearchDistributionTest extends TestCase
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

    public function test_suitability_filtering_in_distribution(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);

        $author = $this->makeStaff('research_analyst');
        $compliance = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('research_head');
        $approver->employee->forceFill(['is_authorized_research_person' => true])->save();

        $this->prepareComplianceGate($compliance, $approver);

        $questionnaire = \App\Models\RiskQuestionnaire::create(['code' => 'suitability', 'title' => 'Suitability']);
        $qVersion = new \App\Models\RiskQuestionnaireVersion([
            'risk_questionnaire_id' => $questionnaire->id, 'version' => 1, 'methodology_version' => 'test-1.0',
            'bands' => [['key' => 'balanced', 'label' => 'Balanced', 'min_score' => 0, 'max_score' => 100]],
        ]);
        $qVersion->save();

        // 1. Client A: Conservative risk profile with active subscription
        $clientAUser = $this->makeClient(['email' => 'clienta@example.test']);
        $clientA = Client::create([
            'user_id' => $clientAUser->id,
            'client_code' => 'CL-001',
            'full_name' => 'Client Conservative',
            'email' => $clientAUser->email,
        ]);
        $rpA = new RiskProfile();
        $rpA->forceFill([
            'client_id' => $clientA->id,
            'risk_questionnaire_version_id' => $qVersion->id,
            'risk_category' => 'CONSERVATIVE',
            'raw_score' => 20,
            'max_score' => 100,
            'methodology_version' => 'test-1.0',
            'status' => RiskProfile::FINALIZED,
            'answers_sha256' => str_repeat('a', 64),
            'finalized_at' => now(),
        ])->save();
        $this->createActiveSubscription($clientA);

        // 2. Client B: Aggressive risk profile with active subscription
        $clientBUser = $this->makeClient(['email' => 'clientb@example.test']);
        $clientB = Client::create([
            'user_id' => $clientBUser->id,
            'client_code' => 'CL-002',
            'full_name' => 'Client Aggressive',
            'email' => $clientBUser->email,
        ]);
        $rpB = new RiskProfile();
        $rpB->forceFill([
            'client_id' => $clientB->id,
            'risk_questionnaire_version_id' => $qVersion->id,
            'risk_category' => 'AGGRESSIVE',
            'raw_score' => 85,
            'max_score' => 100,
            'methodology_version' => 'test-1.0',
            'status' => RiskProfile::FINALIZED,
            'answers_sha256' => str_repeat('b', 64),
            'finalized_at' => now(),
        ])->save();
        $this->createActiveSubscription($clientB);

        // 3. Client C: Active subscription, but NO risk profile (defaults to moderate)
        $clientCUser = $this->makeClient(['email' => 'clientc@example.test']);
        $clientC = Client::create([
            'user_id' => $clientCUser->id,
            'client_code' => 'CL-003',
            'full_name' => 'Client No Risk',
            'email' => $clientCUser->email,
        ]);
        $this->createActiveSubscription($clientC);

        // 4. Create and publish HIGH risk recommendation report
        $report = $workflow->createReport($author, [
            'title' => 'High Beta Futures Call',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'High risk trading call.',
        ]);
        $version = $report->currentVersion;

        $workflow->addRecommendation($version, [
            'instrument' => 'TATAMOTORS',
            'direction' => 'BUY',
            'entry_low' => 970.0,
            'entry_high' => 990.0,
            'stop_loss' => 920.0,
            'targets' => [1050.0],
            'time_horizon' => '1 week',
            'risk_classification' => 'HIGH', // High risk!
        ]);

        $snapshot = $snapshotService->snapshotQuote('TATAMOTORS');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        $workflow->submitForReview($author, $version->fresh());
        $workflow->complianceReview($compliance, $version->fresh(), 'CLEAR');
        $workflow->analystApprove($approver, $version->fresh(), 'Approved');
        $version = $workflow->publish($approver, $version->fresh());

        // Check distribution outcomes:
        // Client A (Conservative) -> SKIPPED_SUITABILITY
        $this->assertDatabaseHas('research_distributions', [
            'research_version_id' => $version->id,
            'client_id' => $clientA->id,
            'delivery_status' => ResearchDistribution::STATUS_SKIPPED_SUITABILITY,
        ]);

        // Client B (Aggressive) -> DELIVERED
        $this->assertDatabaseHas('research_distributions', [
            'research_version_id' => $version->id,
            'client_id' => $clientB->id,
            'delivery_status' => ResearchDistribution::STATUS_DELIVERED,
        ]);

        // Client C (Moderate < High) -> SKIPPED_SUITABILITY
        $this->assertDatabaseHas('research_distributions', [
            'research_version_id' => $version->id,
            'client_id' => $clientC->id,
            'delivery_status' => ResearchDistribution::STATUS_SKIPPED_SUITABILITY,
        ]);
    }

    private function createActiveSubscription(Client $client): Subscription
    {
        $service = Service::firstOrCreate(
            ['code' => 'equity-pro'],
            ['name' => 'Equity Pro', 'category' => 'research']
        );
        $plan = Plan::firstOrCreate(
            ['code' => 'equity-pro-monthly'],
            ['service_id' => $service->id, 'name' => 'Monthly', 'billing_cycle' => 'monthly', 'duration_days' => 30]
        );
        $planVersion = \App\Models\PlanVersion::firstOrCreate(
            ['plan_id' => $plan->id, 'version' => 1],
            ['base_price_paise' => 100000, 'tax_code' => 'gst_18']
        );
        $planVersion->forceFill(['status' => 'published', 'published_at' => now()])->save();

        $sub = new Subscription(['client_id' => $client->id]);
        $sub->forceFill([
            'plan_version_id' => $planVersion->id,
            'starts_on' => now()->subDays(5)->toDateString(),
            'ends_on' => now()->addDays(25)->toDateString(),
            'status' => Subscription::ACTIVE,
        ])->save();

        return $sub;
    }
}
