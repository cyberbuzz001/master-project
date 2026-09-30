<?php

namespace App\Domain\Research;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Shared\ApiException;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\MarketDataSnapshot;
use App\Models\ResearchApproval;
use App\Models\ResearchRecommendation;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ResearchWorkflowService
{
    public function __construct(
        protected ComplianceGate $complianceGate,
        protected DisclosureEngine $disclosureEngine,
        protected MarketDataSnapshotService $snapshotService,
        protected PerformanceLedgerService $performanceService,
        protected ResearchDistributionService $distributionService,
    ) {}

    /**
     * Create a new research report with initial draft version.
     */
    public function createReport(User $user, array $data): ResearchReport
    {
        $employee = $user->employee;
        if ($employee === null) {
            throw ApiException::forbidden('Only staff employees can create research reports.', 'EMPLOYEE_REQUIRED');
        }

        return DB::transaction(function () use ($user, $employee, $data) {
            $year = CarbonImmutable::now()->year;
            $count = ResearchReport::whereYear('created_at', $year)->count() + 1;
            $reportCode = sprintf('REP-%d-%04d', $year, $count);

            $report = ResearchReport::create([
                'uuid' => (string) Str::uuid(),
                'report_code' => $reportCode,
                'title' => $data['title'],
                'report_type' => $data['report_type'] ?? ResearchReport::TYPE_TECHNICAL,
                'category' => $data['category'] ?? ResearchReport::CATEGORY_RECOMMENDATION,
                'archive_status' => 'active',
                'is_demo' => (bool) ($data['is_demo'] ?? false),
            ]);

            $version = ResearchVersion::create([
                'research_report_id' => $report->id,
                'version' => 1,
                'status' => ResearchVersion::STATUS_DRAFT,
                'title' => $data['title'],
                'summary' => $data['summary'] ?? null,
                'body' => $data['body'] ?? null,
                'sections' => $data['sections'] ?? null,
                'author_employee_id' => $employee->id,
                'data_snapshot_id' => $data['data_snapshot_id'] ?? null,
                'valid_until' => isset($data['valid_until']) ? CarbonImmutable::parse($data['valid_until']) : null,
            ]);

            if (! empty($data['recommendations']) && is_array($data['recommendations'])) {
                foreach ($data['recommendations'] as $rec) {
                    $this->addRecommendation($version, $rec);
                }
            }

            $report->update(['current_version_id' => $version->id]);

            ResearchApproval::create([
                'research_version_id' => $version->id,
                'stage' => ResearchApproval::STAGE_SUBMISSION,
                'action' => ResearchApproval::ACTION_SUBMIT,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $employee->id,
                'comments' => 'Created draft report',
            ]);

            return $report->fresh(['currentVersion.recommendations', 'currentVersion.author']);
        });
    }

    /**
     * Add a recommendation to a draft version.
     */
    public function addRecommendation(ResearchVersion $version, array $data): ResearchRecommendation
    {
        if ($version->status !== ResearchVersion::STATUS_DRAFT) {
            throw ApiException::unprocessable('INVALID_STATE', 'Recommendations can only be added to draft versions.');
        }

        $targets = is_array($data['targets'] ?? null) ? $data['targets'] : [(float) ($data['target'] ?? 0)];

        return ResearchRecommendation::create([
            'research_version_id' => $version->id,
            'instrument' => strtoupper($data['instrument']),
            'exchange' => strtoupper($data['exchange'] ?? 'NSE'),
            'segment' => $data['segment'] ?? ResearchRecommendation::SEGMENT_CASH,
            'direction' => strtoupper($data['direction'] ?? ResearchRecommendation::DIRECTION_BUY),
            'entry_low' => $data['entry_low'],
            'entry_high' => $data['entry_high'],
            'stop_loss' => $data['stop_loss'],
            'targets' => $targets,
            'time_horizon' => $data['time_horizon'] ?? '1-3 months',
            'risk_classification' => strtoupper($data['risk_classification'] ?? ResearchRecommendation::RISK_MODERATE),
            'risk_reward' => $data['risk_reward'] ?? null,
            'invalidation_condition' => $data['invalidation_condition'] ?? null,
            'data_as_of' => isset($data['data_as_of']) ? CarbonImmutable::parse($data['data_as_of']) : CarbonImmutable::now(),
            'status' => ResearchRecommendation::STATUS_ACTIVE,
        ]);
    }

    /**
     * Submit draft for automated AI / rule review and Compliance review.
     */
    public function submitForReview(User $user, ResearchVersion $version): ResearchVersion
    {
        if ($version->status !== ResearchVersion::STATUS_DRAFT) {
            throw ApiException::unprocessable('INVALID_STATE_TRANSITION', "Cannot submit research from status [{$version->status}].");
        }

        $employee = $user->employee;
        if (! $user->can('research.edit_draft') && ($employee === null || $employee->id !== $version->author_employee_id)) {
            throw ApiException::forbidden('Only the author may submit research for review.', 'NOT_AUTHOR');
        }

        // Hard checks:
        if (empty($version->title) || (empty($version->summary) && empty($version->body))) {
            throw ApiException::unprocessable('INCOMPLETE_RESEARCH', 'Research title and summary or body are required.');
        }

        if ($version->report->category === ResearchReport::CATEGORY_RECOMMENDATION && $version->recommendations()->count() === 0) {
            throw ApiException::unprocessable('RECOMMENDATIONS_REQUIRED', 'At least one recommendation is required for this report category.');
        }

        // Validate market data snapshot
        if ($version->data_snapshot_id === null) {
            throw ApiException::unprocessable('DATA_SNAPSHOT_REQUIRED', 'A market data snapshot must be attached before submitting.');
        }

        $snapshot = $version->snapshot;
        if ($snapshot === null) {
            throw ApiException::unprocessable('DATA_SNAPSHOT_REQUIRED', 'Referenced market data snapshot does not exist.');
        }

        $this->snapshotService->assertFresh($snapshot);

        // Validate recommendation price level consistency
        foreach ($version->recommendations as $rec) {
            $this->validatePriceLevels($rec);
        }

        // Log AI Review clearance
        ResearchApproval::create([
            'research_version_id' => $version->id,
            'stage' => ResearchApproval::STAGE_AI_REVIEW,
            'action' => ResearchApproval::ACTION_CLEAR,
            'actor_user_id' => $user->id,
            'actor_employee_id' => $employee?->id,
            'comments' => 'Automated consistency and snapshot staleness checks passed.',
        ]);

        $version->update(['status' => ResearchVersion::STATUS_COMPLIANCE_REVIEW]);

        return $version->fresh();
    }

    /**
     * Review by Compliance Officer.
     */
    public function complianceReview(
        User $user,
        ResearchVersion $version,
        string $decision,
        ?string $comment = null,
        array $declarations = []
    ): ResearchVersion {
        if ($version->status !== ResearchVersion::STATUS_COMPLIANCE_REVIEW) {
            throw ApiException::unprocessable('INVALID_STATE_TRANSITION', "Compliance review cannot be performed on status [{$version->status}].");
        }

        if (! $user->can('research.compliance_review')) {
            throw ApiException::forbidden('User lacks research.compliance_review permission.', 'UNAUTHORIZED');
        }

        $decision = strtoupper($decision);
        $employee = $user->employee;

        if ($decision === 'CLEAR' || $decision === 'APPROVE') {
            // Bind disclosures
            $this->disclosureEngine->bindDisclosures($version, $declarations);

            $version->update([
                'status' => ResearchVersion::STATUS_ANALYST_REVIEW,
                'compliance_reviewer_id' => $user->id,
                'compliance_reviewed_at' => CarbonImmutable::now(),
                'compliance_comment' => $comment,
            ]);

            ResearchApproval::create([
                'research_version_id' => $version->id,
                'stage' => ResearchApproval::STAGE_COMPLIANCE_REVIEW,
                'action' => ResearchApproval::ACTION_CLEAR,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $employee?->id,
                'comments' => $comment ?? 'Compliance review cleared with mandatory disclosures bound.',
            ]);
        } elseif ($decision === 'REQUEST_CHANGES') {
            $version->update([
                'status' => ResearchVersion::STATUS_DRAFT,
                'compliance_comment' => $comment,
            ]);

            ResearchApproval::create([
                'research_version_id' => $version->id,
                'stage' => ResearchApproval::STAGE_COMPLIANCE_REVIEW,
                'action' => ResearchApproval::ACTION_REQUEST_CHANGES,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $employee?->id,
                'comments' => $comment ?? 'Changes requested by compliance.',
            ]);
        } elseif ($decision === 'REJECT') {
            $version->update([
                'status' => ResearchVersion::STATUS_REJECTED,
                'rejection_reason' => $comment,
            ]);

            ResearchApproval::create([
                'research_version_id' => $version->id,
                'stage' => ResearchApproval::STAGE_COMPLIANCE_REVIEW,
                'action' => ResearchApproval::ACTION_REJECT,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $employee?->id,
                'comments' => $comment ?? 'Rejected by compliance.',
            ]);
        } else {
            throw ApiException::unprocessable('INVALID_DECISION', "Invalid compliance decision: [{$decision}].");
        }

        return $version->fresh();
    }

    /**
     * Final approval by Authorized Research Analyst.
     * Enforces Separation of Duties: author CANNOT approve!
     */
    public function analystApprove(User $user, ResearchVersion $version, string $comment): ResearchVersion
    {
        if ($version->status !== ResearchVersion::STATUS_ANALYST_REVIEW) {
            throw ApiException::unprocessable('INVALID_STATE_TRANSITION', "Analyst approval cannot be performed on status [{$version->status}].");
        }

        if (! $user->can('research.approve')) {
            throw ApiException::forbidden('User lacks research.approve permission.', 'UNAUTHORIZED');
        }

        $employee = $user->employee;

        // Separation of duties check
        if ($employee?->id === $version->author_employee_id) {
            throw ApiException::forbidden(
                'Separation of duties violation: The author of a research report cannot approve their own report.',
                'SEPARATION_OF_DUTIES_VIOLATION'
            );
        }

        if ($employee === null || ! $employee->is_authorized_research_person) {
            throw ApiException::forbidden('Approver must be explicitly certified as an authorized research person.', 'RESEARCH_PERSON_UNAUTHORIZED');
        }

        $now = CarbonImmutable::now();

        $version->update([
            'status' => ResearchVersion::STATUS_APPROVED,
            'approver_id' => $user->id,
            'approved_at' => $now,
            'approval_comment' => $comment,
        ]);

        ResearchApproval::create([
            'research_version_id' => $version->id,
            'stage' => ResearchApproval::STAGE_ANALYST_REVIEW,
            'action' => ResearchApproval::ACTION_APPROVE,
            'actor_user_id' => $user->id,
            'actor_employee_id' => $employee->id,
            'comments' => $comment,
        ]);

        return $version->fresh();
    }

    /**
     * Publish approved research.
     * Enforces ComplianceGate fail-closed check, locks version as immutable,
     * triggers distribution and initializes performance tracking ledger.
     */
    public function publish(User $user, ResearchVersion $version): ResearchVersion
    {
        if ($version->status !== ResearchVersion::STATUS_APPROVED) {
            throw ApiException::unprocessable('INVALID_STATE_TRANSITION', "Only APPROVED research can be published. Current status: [{$version->status}].");
        }

        if (! $user->can('research.publish')) {
            throw ApiException::forbidden('User lacks research.publish permission.', 'UNAUTHORIZED');
        }

        if ($version->valid_until !== null && $version->valid_until->isPast()) {
            $version->update(['status' => ResearchVersion::STATUS_EXPIRED]);
            throw ApiException::unprocessable('RESEARCH_EXPIRED', 'Research validity date has already passed. It cannot be published.');
        }

        // Enforce fail-closed Compliance Gate check
        $this->complianceGate->assertCanPublish($version->report->category);

        $now = CarbonImmutable::now();

        // Calculate cryptographic content hash
        $contentPayload = [
            'report_code' => $version->report->report_code,
            'version' => $version->version,
            'title' => $version->title,
            'summary' => $version->summary,
            'body' => $version->body,
            'recommendations' => $version->recommendations->map->toArray()->all(),
            'disclosure_set_hash' => $version->disclosure_set_hash,
            'approved_by' => $version->approver_id,
            'approved_at' => $version->approved_at?->toIso8601String(),
        ];
        $contentHash = hash('sha256', json_encode($contentPayload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));

        DB::transaction(function () use ($user, $version, $now, $contentHash) {
            $version->update([
                'status' => ResearchVersion::STATUS_PUBLISHED,
                'published_at' => $now,
                'publisher_id' => $user->id,
                'content_hash' => $contentHash,
            ]);

            $version->report->update(['current_version_id' => $version->id]);

            ResearchApproval::create([
                'research_version_id' => $version->id,
                'stage' => ResearchApproval::STAGE_PUBLICATION,
                'action' => ResearchApproval::ACTION_PUBLISH,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $user->employee?->id,
                'comments' => 'Published and broadcast to authorized clients.',
            ]);

            // Initialize performance ledger
            $this->performanceService->initializeTracking($version);

            // Trigger client distribution
            $this->distributionService->distribute($version);
        });

        return $version->fresh(['recommendations.performance', 'report', 'disclosureBinding']);
    }

    /**
     * Create a new draft version (n+1) from an existing published/archived report.
     */
    public function createNewVersion(User $user, ResearchReport $report): ResearchVersion
    {
        $employee = $user->employee;
        if ($employee === null) {
            throw ApiException::forbidden('Only staff employees can create research versions.', 'EMPLOYEE_REQUIRED');
        }

        return DB::transaction(function () use ($user, $employee, $report) {
            $latest = $report->versions()->latest('version')->firstOrFail();
            $nextVersionNumber = $latest->version + 1;

            $newVersion = ResearchVersion::create([
                'research_report_id' => $report->id,
                'version' => $nextVersionNumber,
                'status' => ResearchVersion::STATUS_DRAFT,
                'title' => $latest->title,
                'summary' => $latest->summary,
                'body' => $latest->body,
                'sections' => $latest->sections,
                'author_employee_id' => $employee->id,
                'data_snapshot_id' => $latest->data_snapshot_id,
                'valid_until' => $latest->valid_until,
            ]);

            foreach ($latest->recommendations as $rec) {
                $recData = $rec->toArray();
                unset($recData['id'], $recData['created_at'], $recData['updated_at'], $recData['research_version_id']);
                $this->addRecommendation($newVersion, $recData);
            }

            ResearchApproval::create([
                'research_version_id' => $newVersion->id,
                'stage' => ResearchApproval::STAGE_SUBMISSION,
                'action' => ResearchApproval::ACTION_SUBMIT,
                'actor_user_id' => $user->id,
                'actor_employee_id' => $employee->id,
                'comments' => "Drafted version {$nextVersionNumber} superseding version {$latest->version}.",
            ]);

            return $newVersion->fresh(['recommendations']);
        });
    }

    /**
     * Validate logical consistency of price levels.
     */
    protected function validatePriceLevels(ResearchRecommendation $rec): void
    {
        $low = (float) $rec->entry_low;
        $high = (float) $rec->entry_high;
        $sl = (float) $rec->stop_loss;
        $targets = is_array($rec->targets) ? $rec->targets : [];

        if ($low > $high) {
            throw ApiException::unprocessable('INVALID_LEVELS', "Entry low ({$low}) cannot be greater than entry high ({$high}).");
        }

        if (empty($targets)) {
            throw ApiException::unprocessable('INVALID_LEVELS', 'At least one target level must be specified.');
        }

        $target1 = (float) $targets[0];

        if ($rec->direction === ResearchRecommendation::DIRECTION_BUY || $rec->direction === ResearchRecommendation::DIRECTION_ACCUMULATE) {
            if ($sl >= $low) {
                throw ApiException::unprocessable('INVALID_LEVELS', "For BUY recommendation, Stop Loss ({$sl}) must be lower than Entry Low ({$low}).");
            }
            if ($target1 <= $high) {
                throw ApiException::unprocessable('INVALID_LEVELS', "For BUY recommendation, Target 1 ({$target1}) must be higher than Entry High ({$high}).");
            }
        } elseif ($rec->direction === ResearchRecommendation::DIRECTION_SELL) {
            if ($sl <= $high) {
                throw ApiException::unprocessable('INVALID_LEVELS', "For SELL recommendation, Stop Loss ({$sl}) must be higher than Entry High ({$high}).");
            }
            if ($target1 >= $low) {
                throw ApiException::unprocessable('INVALID_LEVELS', "For SELL recommendation, Target 1 ({$target1}) must be lower than Entry Low ({$low}).");
            }
        }
    }
}
