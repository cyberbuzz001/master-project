<?php

namespace Tests\Feature;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\MarketData\Providers\MockMarketDataProvider;
use App\Domain\Research\PerformanceLedgerService;
use App\Domain\Research\ResearchWorkflowService;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\ResearchPerformance;
use App\Models\ResearchRecommendation;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class PerformanceLedgerTest extends TestCase
{
    protected function tearDown(): void
    {
        MockMarketDataProvider::clearOverrides();
        parent::tearDown();
    }

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

    public function test_target_hit_detected_and_mfe_recorded(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);
        $ledger = app(PerformanceLedgerService::class);

        $author = $this->makeStaff('research_analyst');
        $compliance = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('research_head');
        $approver->employee->forceFill(['is_authorized_research_person' => true])->save();

        $this->prepareComplianceGate($compliance, $approver);

        $report = $workflow->createReport($author, [
            'title' => 'TCS Momentum Call',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'Bullish continuation on TCS towards 4500.',
        ]);
        $version = $report->currentVersion;

        $rec = $workflow->addRecommendation($version, [
            'instrument' => 'TCS',
            'direction' => 'BUY',
            'entry_low' => 4150.0,
            'entry_high' => 4250.0, // entry_ref = 4200.0
            'stop_loss' => 4000.0,
            'targets' => [4400.0, 4500.0],
            'time_horizon' => '1 month',
            'risk_classification' => 'MODERATE',
        ]);

        $snapshot = $snapshotService->snapshotQuote('TCS');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        $workflow->submitForReview($author, $version->fresh());
        $workflow->complianceReview($compliance, $version->fresh(), 'CLEAR');
        $workflow->analystApprove($approver, $version->fresh(), 'Approved');
        $workflow->publish($approver, $version->fresh());

        $perf = $rec->fresh()->performance;
        $this->assertNotNull($perf);
        $this->assertEquals(4200.0, $perf->entry_ref);
        $this->assertSame(ResearchPerformance::OUTCOME_PENDING, $perf->outcome);

        // Price rises above target 1 (4400) -> 4450
        MockMarketDataProvider::setPriceOverride('TCS', 4450.0);

        $evaluated = $ledger->trackPerformance();
        $this->assertGreaterThanOrEqual(1, $evaluated);

        $perf = $perf->fresh();
        $this->assertSame(ResearchPerformance::OUTCOME_TARGET_HIT, $perf->outcome);
        $this->assertSame(ResearchRecommendation::STATUS_TARGET_HIT, $rec->fresh()->status);
        $this->assertGreaterThan(0, $perf->mfe);
    }

    public function test_stop_loss_hit_detected_and_mae_recorded(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);
        $ledger = app(PerformanceLedgerService::class);

        $author = $this->makeStaff('research_analyst');
        $compliance = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('research_head');
        $approver->employee->forceFill(['is_authorized_research_person' => true])->save();

        $this->prepareComplianceGate($compliance, $approver);

        $report = $workflow->createReport($author, [
            'title' => 'INFY Long Call',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'INFY breakout setup.',
        ]);
        $version = $report->currentVersion;

        $rec = $workflow->addRecommendation($version, [
            'instrument' => 'INFY',
            'direction' => 'BUY',
            'entry_low' => 1840.0,
            'entry_high' => 1860.0, // entry_ref = 1850.0
            'stop_loss' => 1780.0,
            'targets' => [1950.0],
            'time_horizon' => '2 weeks',
            'risk_classification' => 'HIGH',
        ]);

        $snapshot = $snapshotService->snapshotQuote('INFY');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        $workflow->submitForReview($author, $version->fresh());
        $workflow->complianceReview($compliance, $version->fresh(), 'CLEAR');
        $workflow->analystApprove($approver, $version->fresh(), 'Approved');
        $workflow->publish($approver, $version->fresh());

        // Price drops below stop loss (1780) -> 1750
        MockMarketDataProvider::setPriceOverride('INFY', 1750.0);

        $ledger->trackPerformance();

        $perf = $rec->fresh()->performance;
        $this->assertSame(ResearchPerformance::OUTCOME_STOP_LOSS_HIT, $perf->outcome);
        $this->assertSame(ResearchRecommendation::STATUS_STOP_LOSS_HIT, $rec->fresh()->status);
        $this->assertGreaterThan(0, $perf->mae);
    }
}
