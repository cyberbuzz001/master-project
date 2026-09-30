<?php

namespace Tests\Feature;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Research\ResearchWorkflowService;
use App\Domain\Shared\ApiException;
use App\Models\Employee;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\ResearchApproval;
use App\Models\ResearchRecommendation;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use LogicException;
use Tests\TestCase;

class ResearchWorkflowTest extends TestCase
{
    /**
     * Seeds required policies and a verified regulatory profile so ComplianceGate can pass.
     */
    private function prepareComplianceGate(User $creator, User $verifier): void
    {
        // 1. Create and verify regulatory profile
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

        // 2. Publish required policies
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

    public function test_full_research_workflow_lifecycle(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);

        // 1. Staff setup
        $authorUser = $this->makeStaff('research_analyst', ['email' => 'author@example.test']);
        $complianceUser = $this->makeStaff('compliance_admin', ['email' => 'compliance@example.test']);
        $approverUser = $this->makeStaff('research_head', ['email' => 'approver@example.test']);
        $unauthorizedUser = $this->makeStaff('research_analyst', ['email' => 'unauth@example.test']);

        // Mark approver as authorized research person
        $approverUser->employee->forceFill([
            'is_authorized_research_person' => true,
            'research_authorized_at' => now(),
        ])->save();

        // 2. Author creates draft report
        $report = $workflow->createReport($authorUser, [
            'title' => 'Reliance Industries: Breakout on Heavy Volume',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'Strong bullish continuation expected towards 3200 with SL below 2850.',
            'body' => 'Full technical analysis body text citing 50-day EMA support.',
            'valid_until' => CarbonImmutable::now()->addDays(14)->toIso8601String(),
        ]);

        $this->assertInstanceOf(ResearchReport::class, $report);
        $this->assertSame('active', $report->archive_status);
        $version = $report->currentVersion;
        $this->assertSame(ResearchVersion::STATUS_DRAFT, $version->status);

        // 3. Add recommendation
        $rec = $workflow->addRecommendation($version, [
            'instrument' => 'RELIANCE',
            'exchange' => 'NSE',
            'segment' => 'EQUITY_CASH',
            'direction' => 'BUY',
            'entry_low' => 2940.0,
            'entry_high' => 2960.0,
            'stop_loss' => 2850.0,
            'targets' => [3100.0, 3200.0],
            'time_horizon' => '1-3 months',
            'risk_classification' => 'MODERATE',
        ]);
        $this->assertEquals(2950.0, $rec->entryReference());

        // 4. Submitting without snapshot fails
        $version = $version->fresh();
        try {
            $workflow->submitForReview($authorUser, $version);
            $this->fail('Expected submission without snapshot to fail.');
        } catch (ApiException $e) {
            $this->assertSame('DATA_SNAPSHOT_REQUIRED', $e->errorCode);
        }

        // Attach fresh snapshot
        $snapshot = $snapshotService->snapshotQuote('RELIANCE');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        // 5. Submit for review succeeds and transitions to COMPLIANCE_REVIEW
        $version = $workflow->submitForReview($authorUser, $version->fresh());
        $this->assertSame(ResearchVersion::STATUS_COMPLIANCE_REVIEW, $version->status);
        $this->assertDatabaseHas('research_approvals', [
            'research_version_id' => $version->id,
            'stage' => ResearchApproval::STAGE_AI_REVIEW,
            'action' => ResearchApproval::ACTION_CLEAR,
        ]);

        // 6. Compliance review: request changes first
        $version = $workflow->complianceReview($complianceUser, $version, 'REQUEST_CHANGES', 'Please elaborate on risk disclosure.');
        $this->assertSame(ResearchVersion::STATUS_DRAFT, $version->status);

        // Re-submit
        $version = $workflow->submitForReview($authorUser, $version);
        $this->assertSame(ResearchVersion::STATUS_COMPLIANCE_REVIEW, $version->status);

        // Compliance clears review with declarations
        $version = $workflow->complianceReview($complianceUser, $version, 'CLEAR', 'All checks verified.', [
            'has_financial_interest' => false,
            'has_beneficial_ownership' => false,
            'has_conflict_of_interest' => false,
        ]);
        $this->assertSame(ResearchVersion::STATUS_ANALYST_REVIEW, $version->status);
        $this->assertNotNull($version->disclosure_set_hash);
        $this->assertDatabaseHas('disclosure_bindings', [
            'research_version_id' => $version->id,
            'conflict_of_interest_declared' => false,
        ]);

        // 7. Separation of Duties: Author CANNOT approve own report
        try {
            $workflow->analystApprove($authorUser, $version, 'Self approval attempt');
            $this->fail('Expected author self-approval to fail separation of duties.');
        } catch (ApiException $e) {
            $this->assertSame('SEPARATION_OF_DUTIES_VIOLATION', $e->errorCode);
        }

        // 8. Unauthorized employee CANNOT approve
        try {
            $workflow->analystApprove($unauthorizedUser, $version, 'Unauthorized approval attempt');
            $this->fail('Expected non-authorized employee approval to fail.');
        } catch (ApiException $e) {
            $this->assertSame('RESEARCH_PERSON_UNAUTHORIZED', $e->errorCode);
        }

        // 9. Certified authorized research person approves
        $version = $workflow->analystApprove($approverUser, $version, 'Fundamental and technical setup verified.');
        $this->assertSame(ResearchVersion::STATUS_APPROVED, $version->status);
        $this->assertSame($approverUser->id, $version->approver_id);

        // 10. Publication gate: publishing without active verified profile fails
        try {
            $workflow->publish($approverUser, $version);
            $this->fail('Expected publish to fail when compliance gate is incomplete.');
        } catch (ApiException $e) {
            $this->assertSame('COMPLIANCE_CONFIGURATION_INCOMPLETE', $e->errorCode);
        }

        // Set up compliance gate (verified profile & required policies)
        $this->prepareComplianceGate($complianceUser, $approverUser);

        // 11. Publish succeeds
        $version = $workflow->publish($approverUser, $version->fresh());
        $this->assertSame(ResearchVersion::STATUS_PUBLISHED, $version->status);
        $this->assertNotNull($version->content_hash);
        $this->assertNotNull($version->published_at);
        $this->assertSame($approverUser->id, $version->publisher_id);

        // Current version on report updated
        $this->assertSame($version->id, $version->report->fresh()->current_version_id);

        // Performance tracking initialized
        $this->assertDatabaseHas('research_performance', [
            'recommendation_id' => $rec->id,
            'entry_ref' => 2950.0,
            'outcome' => 'PENDING',
        ]);

        // 12. Immutability: Attempting to edit or delete published version throws LogicException
        try {
            $version->update(['title' => 'Tampered Title']);
            $this->fail('Expected update on published version to throw LogicException.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('immutable', $e->getMessage());
        }

        try {
            $version->delete();
            $this->fail('Expected delete on published version to throw LogicException.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('cannot be deleted', $e->getMessage());
        }

        // 13. Create Version 2 (n+1)
        $v2 = $workflow->createNewVersion($authorUser, $version->report);
        $this->assertSame(2, $v2->version);
        $this->assertSame(ResearchVersion::STATUS_DRAFT, $v2->status);
        $this->assertSame($version->report_id, $v2->report_id);
        $this->assertSame(1, $v2->recommendations()->count());
    }

    public function test_recommendation_price_levels_validation(): void
    {
        $workflow = app(ResearchWorkflowService::class);
        $snapshotService = app(MarketDataSnapshotService::class);
        $authorUser = $this->makeStaff('research_analyst');

        $report = $workflow->createReport($authorUser, [
            'title' => 'Invalid Levels Test',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'category' => ResearchReport::CATEGORY_RECOMMENDATION,
            'summary' => 'Testing validation',
        ]);
        $version = $report->currentVersion;

        // Invalid BUY: Stop loss above entry low
        $workflow->addRecommendation($version, [
            'instrument' => 'TCS',
            'direction' => 'BUY',
            'entry_low' => 4200.0,
            'entry_high' => 4250.0,
            'stop_loss' => 4220.0, // Invalid!
            'targets' => [4400.0],
            'time_horizon' => '1 month',
        ]);

        $snapshot = $snapshotService->snapshotQuote('TCS');
        $version->update(['data_snapshot_id' => $snapshot->id]);

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('Stop Loss');

        $workflow->submitForReview($authorUser, $version->fresh());
    }
}
