<?php

namespace Tests\Feature;

use App\Domain\Crm\FollowupMonitor;
use App\Domain\Crm\ImportRollbackService;
use App\Domain\Crm\LeadAssignmentService;
use App\Domain\Crm\LeadStatus;
use App\Domain\Crm\LeadWorkflowService;
use App\Domain\Platform\Settings;
use App\Domain\Shared\ApiException;
use App\Filament\Imports\LeadImporter;
use App\Models\CallLog;
use App\Models\ConsentRecord;
use App\Models\Followup;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\SystemSetting;
use App\Models\Team;
use App\Models\User;
use App\Models\Vendor;
use Database\Seeders\LeadSourceSeeder;
use Database\Seeders\SystemSettingsSeeder;
use Filament\Actions\Imports\Exceptions\RowImportFailedException;
use Filament\Actions\Imports\Models\Import;
use LogicException;
use Tests\TestCase;

class CrmWorkflowTest extends TestCase
{
    private LeadWorkflowService $workflow;

    private LeadAssignmentService $assignments;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LeadSourceSeeder::class, SystemSettingsSeeder::class]);
        $this->workflow = app(LeadWorkflowService::class);
        $this->assignments = app(LeadAssignmentService::class);
    }

    private function leadFor(?User $owner, array $attributes = []): Lead
    {
        return Lead::forceCreate(array_merge([
            'full_name' => 'Prospect',
            'mobile' => '+919800000'.random_int(100, 999),
            'status' => 'NEW',
            'assigned_employee_id' => $owner?->employee?->id,
        ], $attributes));
    }

    public function test_call_outcome_moves_status_and_writes_history_timeline_and_audit(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->leadFor($advisor);

        $this->workflow->logCall($advisor, $lead, ['outcome' => 'no_answer', 'notes' => 'Rang twice']);

        $lead->refresh();
        $this->assertSame('NPC', $lead->status);
        $this->assertNotNull($lead->last_contacted_at);
        $this->assertSame(1, CallLog::query()->where('lead_id', $lead->id)->count());
        $this->assertDatabaseHas('lead_status_histories', ['lead_id' => $lead->id, 'from_status' => 'NEW', 'to_status' => 'NPC', 'changed_by' => $advisor->id]);
        $this->assertEqualsCanonicalizing(['call', 'status_changed'], LeadActivity::query()->where('lead_id', $lead->id)->pluck('type')->all());
        $this->assertDatabaseHas('audit_logs', ['action' => 'lead.status_changed', 'subject_id' => $lead->id]);
    }

    public function test_callback_requires_future_time_and_creates_followup(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->leadFor($advisor);

        try {
            $this->workflow->logCall($advisor, $lead, ['outcome' => 'callback_requested']);
            $this->fail('Callback without a time should be rejected.');
        } catch (ApiException $e) {
            $this->assertSame('VALIDATION_FAILED', $e->errorCode);
        }

        $this->workflow->logCall($advisor, $lead, ['outcome' => 'callback_requested', 'followup_at' => now()->addDay()]);

        $lead->refresh();
        $this->assertSame('CALL_BACK', $lead->status);
        $this->assertNotNull($lead->next_followup_at);
        $this->assertSame(Followup::PENDING, Followup::query()->where('lead_id', $lead->id)->sole()->status);
    }

    public function test_paid_and_converted_cannot_be_set_manually(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $lead = $this->leadFor(null, ['status' => 'FREE_TRIAL']);

        foreach (['PAID', 'CONVERTED'] as $target) {
            try {
                $this->workflow->changeStatus($manager, $lead, $target, 'Client says they paid');
                $this->fail("Manual {$target} must be refused.");
            } catch (ApiException $e) {
                $this->assertSame('INVALID_STATE_TRANSITION', $e->errorCode);
            }
        }

        $this->workflow->applySystemStatus($lead, LeadStatus::Paid, 'Verified payment #1');
        $this->assertSame('PAID', $lead->fresh()->status);
    }

    public function test_dnd_withdraws_consent_cancels_followups_and_blocks_calls(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->leadFor($advisor);
        $followup = $this->workflow->scheduleFollowup($advisor, $lead, now()->addHours(3), 'call', null);

        $this->workflow->changeStatus($advisor, $lead, 'DND', 'Asked not to be contacted');

        $this->assertSame(Followup::CANCELLED, $followup->fresh()->status);
        $this->assertNull($lead->fresh()->next_followup_at);
        $this->assertFalse(ConsentRecord::query()->where(['subject_type' => 'lead', 'subject_id' => $lead->id, 'purpose' => 'calls'])->latest('id')->first()->granted);

        $this->expectException(ApiException::class);
        try {
            $this->workflow->logCall($advisor, $lead->fresh(), ['outcome' => 'connected']);
        } catch (ApiException $e) {
            $this->assertSame('LEAD_DND', $e->errorCode);

            // Lifting DND is reserved for compliance.
            try {
                $this->workflow->changeStatus($advisor, $lead->fresh(), 'NEW', 'Retry');
                $this->fail('Advisor must not lift DND.');
            } catch (ApiException $inner) {
                $this->assertSame('DND_LIFT_FORBIDDEN', $inner->errorCode);
            }

            throw $e;
        }
    }

    public function test_advisor_cannot_work_someone_elses_lead(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');
        $lead = $this->leadFor($other);

        $this->expectException(ApiException::class);
        $this->workflow->addNote($advisor, $lead, 'Sneaky note');
    }

    public function test_team_leader_can_only_assign_within_team(): void
    {
        $teamA = Team::create(['name' => 'A']);
        $teamB = Team::create(['name' => 'B']);
        $leader = $this->makeStaff('team_leader', [], ['team_id' => $teamA->id]);
        $inTeam = $this->makeStaff('business_advisor', [], ['team_id' => $teamA->id]);
        $outside = $this->makeStaff('business_advisor', [], ['team_id' => $teamB->id]);
        $lead = $this->leadFor($inTeam);

        $this->assertEqualsCanonicalizing([$leader->employee->id, $inTeam->employee->id], $this->assignments->assignableEmployees($leader)->pluck('id')->all());

        try {
            $this->assignments->assign($leader, $lead, $outside->employee, 'Rebalance');
            $this->fail('Cross-team assignment must be refused.');
        } catch (ApiException $e) {
            $this->assertSame('ASSIGNEE_OUT_OF_SCOPE', $e->errorCode);
        }

        $this->assignments->assign($leader, $lead, $leader->employee, 'Taking over');
        $this->assertSame($leader->employee->id, $lead->fresh()->assigned_employee_id);
        $this->assertDatabaseHas('lead_assignments', ['lead_id' => $lead->id, 'from_employee_id' => $inTeam->employee->id, 'to_employee_id' => $leader->employee->id, 'method' => 'manual']);
    }

    public function test_auto_assignment_balances_open_leads_and_keeps_duplicates_with_owner(): void
    {
        SystemSetting::query()->where('key', 'crm.auto_assign_enabled')->update(['value' => '1']);
        $busy = $this->makeStaff('business_advisor');
        $free = $this->makeStaff('business_advisor');
        $this->makeStaff('payment_manager'); // not eligible: cannot work leads
        $this->leadFor($busy);
        $this->leadFor($busy);
        $this->leadFor($free);

        $newLead = $this->leadFor(null, ['mobile' => '+919811111111']);
        $this->assignments->autoAssign($newLead);
        $this->assertSame($free->employee->id, $newLead->fresh()->assigned_employee_id);

        $duplicate = $this->leadFor(null, ['duplicate_of_lead_id' => $newLead->id]);
        $this->assignments->autoAssign($duplicate);
        $this->assertSame($free->employee->id, $duplicate->fresh()->assigned_employee_id);
    }

    public function test_auto_assignment_is_off_by_default(): void
    {
        $this->makeStaff('business_advisor');
        $lead = $this->leadFor(null);

        $this->assertNull($this->assignments->autoAssign($lead));
        $this->assertFalse((bool) app(Settings::class)->get('crm.auto_assign_enabled'));
    }

    public function test_followup_sweep_reminds_then_marks_missed_and_notifies(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->leadFor($advisor);
        $soon = $this->workflow->scheduleFollowup($advisor, $lead, now()->addMinutes(10), 'call', null);
        $overdue = $this->workflow->scheduleFollowup($advisor, $lead, now()->addMinute(), 'whatsapp', null);
        $overdue->forceFill(['due_at' => now()->subHours(3)])->save();

        $result = app(FollowupMonitor::class)->sweep();

        $this->assertSame(['reminded' => 1, 'missed' => 1], $result);
        $this->assertNotNull($soon->fresh()->reminded_at);
        $this->assertSame(Followup::MISSED, $overdue->fresh()->status);
        $this->assertSame(2, $advisor->notifications()->count());
        $this->assertSame(['reminded' => 0, 'missed' => 0], app(FollowupMonitor::class)->sweep());
    }

    public function test_activity_timeline_is_append_only(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $note = $this->workflow->addNote($advisor, $this->leadFor($advisor), 'Interested in equity research');

        $this->expectException(LogicException::class);
        $note->update(['summary' => 'Edited']);
    }

    public function test_csv_import_attributes_flags_duplicates_records_consent_and_rolls_back_untouched_rows(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $advisor = $this->makeStaff('business_advisor');
        $vendor = Vendor::create(['code' => 'acme', 'name' => 'Acme Leads', 'consent_basis' => 'Opt-in form with call consent']);
        $existing = $this->leadFor($advisor, ['mobile' => '+919876500001']);

        $import = Import::create(['file_name' => 'acme.csv', 'file_path' => 'x', 'importer' => LeadImporter::class, 'total_rows' => 2, 'user_id' => $manager->id]);
        $options = ['vendor_id' => $vendor->id, 'consent_basis' => 'Acme webinar sign-up, 10 Sep 2026', 'consent_calls' => true, 'confirm' => true];
        $map = ['full_name' => 'name', 'mobile' => 'phone', 'email' => 'email', 'preferred_segments' => 'segments'];

        $this->actingAs($manager);
        $importer = new LeadImporter($import, $map, $options);
        $importer(['name' => 'Asha Rao', 'phone' => '98765 00001', 'email' => 'asha@example.test', 'segments' => 'equity, options']);
        $importer = new LeadImporter($import, $map, $options);
        $importer(['name' => 'Vikram Shah', 'phone' => '98765 00002', 'email' => '', 'segments' => 'commodity']);

        $asha = Lead::query()->where('full_name', 'Asha Rao')->sole();
        $vikram = Lead::query()->where('full_name', 'Vikram Shah')->sole();

        $this->assertSame('+919876500001', $asha->mobile);
        $this->assertSame($existing->id, $asha->duplicate_of_lead_id);
        $this->assertSame(['equity', 'options'], $asha->preferred_segments);
        $this->assertSame($vendor->id, $asha->vendor_id);
        $this->assertSame('vendor_feed', $asha->source->code);
        $this->assertSame($import->id, $asha->import_id);
        $this->assertTrue(ConsentRecord::query()->where(['subject_id' => $asha->id, 'purpose' => 'calls'])->sole()->granted);
        $this->assertStringContainsString('Acme webinar sign-up', ConsentRecord::query()->where(['subject_id' => $asha->id, 'purpose' => 'data_processing'])->sole()->consent_text);

        // Vikram gets worked before rollback, so he must be kept.
        $vikram->forceFill(['assigned_employee_id' => $advisor->employee->id])->save();
        $this->workflow->logCall($advisor, $vikram, ['outcome' => 'connected']);

        $import->forceFill(['completed_at' => now()])->save();
        $this->assertSame(['removed' => 1, 'kept' => 1], app(ImportRollbackService::class)->preview($import));

        $result = app(ImportRollbackService::class)->rollback($manager, $import, 'Vendor sent a wrong list');

        $this->assertSame(['removed' => 1, 'kept' => 1], $result);
        $this->assertSoftDeleted($asha);
        $this->assertNotSoftDeleted($vikram);
        $this->assertNotNull($import->fresh()->rolled_back_at);

        $this->expectException(ApiException::class);
        app(ImportRollbackService::class)->rollback($manager, $import->fresh(), 'Again');
    }

    public function test_vendor_without_consent_basis_cannot_supply_imported_leads(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $vendor = Vendor::create(['code' => 'noconsent', 'name' => 'No Consent Co']);
        $import = Import::create(['file_name' => 'x.csv', 'file_path' => 'x', 'importer' => LeadImporter::class, 'total_rows' => 1, 'user_id' => $manager->id]);

        $this->actingAs($manager);

        try {
            (new LeadImporter($import, ['full_name' => 'name', 'mobile' => 'phone'], ['vendor_id' => $vendor->id, 'consent_basis' => 'Unknown source list', 'confirm' => true]))(['name' => 'Someone', 'phone' => '9876543210']);
            $this->fail('Row should fail.');
        } catch (RowImportFailedException $e) {
            $this->assertStringContainsString('consent basis', $e->getMessage());
        }

        $this->assertSame(0, Lead::query()->count());
    }
}
