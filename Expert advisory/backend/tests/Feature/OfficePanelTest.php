<?php

namespace Tests\Feature;

use App\Filament\Resources\Campaigns\Pages\ManageCampaigns;
use App\Filament\Resources\Followups\Pages\ListFollowups;
use App\Filament\Resources\Leads\Pages\CreateLead;
use App\Filament\Resources\Leads\Pages\ListLeads;
use App\Filament\Resources\Leads\Pages\ViewLead;
use App\Filament\Resources\ObjectionScripts\Pages\ManageObjectionScripts;
use App\Http\Middleware\RequireTwoFactor;
use App\Models\CallLog;
use App\Models\Followup;
use App\Models\Lead;
use App\Models\ObjectionScript;
use App\Models\User;
use Database\Seeders\LeadSourceSeeder;
use Database\Seeders\SystemSettingsSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Tests\TestCase;

class OfficePanelTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LeadSourceSeeder::class, SystemSettingsSeeder::class]);
        Filament::setCurrentPanel('office');
    }

    private function lead(?User $owner, array $attributes = []): Lead
    {
        return Lead::forceCreate(array_merge([
            'full_name' => 'Prospect '.uniqid(),
            'mobile' => '+9198'.random_int(10000000, 99999999),
            'status' => 'NEW',
            'assigned_employee_id' => $owner?->employee?->id,
        ], $attributes));
    }

    public function test_guest_is_sent_to_shared_login(): void
    {
        $this->withHeaders(['Accept' => 'text/html'])->get('/office')->assertRedirect(config('platform.frontend_url').'/login?next=%2Foffice');
    }

    public function test_client_cannot_enter_back_office(): void
    {
        $this->actingAs($this->makeClient())->get('/office')->assertForbidden();
    }

    public function test_staff_without_two_factor_is_sent_to_enrollment(): void
    {
        $advisor = $this->makeStaff('business_advisor');

        $this->actingAs($advisor)->get('/office')->assertRedirect(config('platform.frontend_url').'/account/security?setup=2fa');
    }

    public function test_enrolled_staff_without_verified_session_is_signed_out(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $this->enableTwoFactor($advisor);

        $this->actingAs($advisor)->get('/office')->assertRedirectContains('/login');
        $this->assertGuest();
    }

    public function test_verified_staff_sees_dashboard(): void
    {
        $this->actingAsVerified($this->makeStaff('sales_manager'))
            ->get('/office')
            ->assertOk()
            ->assertSee('Expert Stocks');
    }

    public function test_advisor_lead_list_is_scoped_to_own_leads(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');
        $mine = $this->lead($advisor);
        $theirs = $this->lead($other);
        $unassigned = $this->lead(null);

        $this->actingAsVerified($advisor);

        Livewire::test(ListLeads::class, ['activeTab' => 'all'])
            ->assertCanSeeTableRecords([$mine])
            ->assertCanNotSeeTableRecords([$theirs, $unassigned])
            ->assertActionHidden(TestAction::make('import')->table());

        // Out-of-scope records are not found (existence is not revealed).
        $this->get('/office/leads/'.$theirs->id)->assertNotFound();

        $due = $this->lead($advisor, ['status' => 'CALL_BACK']);
        $due->forceFill(['next_followup_at' => now()->subHour()])->save();
        $closed = $this->lead($advisor, ['status' => 'LOST']);

        Livewire::test(ListLeads::class)
            ->assertCanSeeTableRecords([$mine, $due])
            ->assertCanNotSeeTableRecords([$closed, $theirs]);

        Livewire::test(ListLeads::class, ['activeTab' => 'due'])
            ->assertCanSeeTableRecords([$due])
            ->assertCanNotSeeTableRecords([$mine, $closed]);
    }

    public function test_manager_sees_all_leads_and_import_action(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $leads = [$this->lead(null), $this->lead($this->makeStaff('business_advisor'))];

        $this->actingAsVerified($manager);

        Livewire::test(ListLeads::class, ['activeTab' => 'all'])
            ->assertCanSeeTableRecords($leads)
            ->assertActionVisible(TestAction::make('import')->table());
    }

    public function test_log_call_action_on_lead_page_uses_workflow(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->lead($advisor);
        $this->actingAsVerified($advisor);

        Livewire::test(ViewLead::class, ['record' => $lead->getKey()])
            ->assertOk()
            ->callAction('logCall', data: ['outcome' => 'no_answer', 'notes' => 'Rang out'])
            ->assertHasNoActionErrors();

        $this->assertSame('NPC', $lead->fresh()->status);
        $this->assertSame(1, CallLog::query()->where('lead_id', $lead->id)->count());
    }

    public function test_status_action_never_offers_paid(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = $this->lead($advisor, ['status' => 'EXPECTED_PAYMENT']);
        $this->actingAsVerified($advisor);

        Livewire::test(ViewLead::class, ['record' => $lead->getKey()])
            ->callAction('changeStatus', data: ['status' => 'PAID', 'reason' => 'Client said paid'])
            ->assertHasActionErrors(['status']);

        $this->assertSame('EXPECTED_PAYMENT', $lead->fresh()->status);
    }

    public function test_advisor_creating_a_lead_becomes_owner_and_consent_is_recorded(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $this->actingAsVerified($advisor);

        Livewire::test(CreateLead::class)
            ->fillForm([
                'full_name' => 'Walk In Prospect',
                'mobile' => '98111 22333',
                'preferred_segments' => ['equity'],
                'consent_channel' => 'walk_in',
                'consent_data_processing' => true,
                'consent_calls' => true,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $lead = Lead::query()->where('full_name', 'Walk In Prospect')->sole();
        $this->assertSame('+919811122333', $lead->mobile);
        $this->assertSame($advisor->employee->id, $lead->assigned_employee_id);
        $this->assertDatabaseHas('consent_records', ['subject_id' => $lead->id, 'purpose' => 'calls', 'granted' => true, 'channel' => 'staff_recorded']);
    }

    public function test_followup_queue_is_scoped_and_completable(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');
        $mine = Followup::forceCreate(['lead_id' => $this->lead($advisor)->id, 'employee_id' => $advisor->employee->id, 'channel' => 'call', 'due_at' => now()->addHour(), 'status' => 'pending']);
        $theirs = Followup::forceCreate(['lead_id' => $this->lead($other)->id, 'employee_id' => $other->employee->id, 'channel' => 'call', 'due_at' => now()->addHour(), 'status' => 'pending']);

        $this->actingAsVerified($advisor);

        Livewire::test(ListFollowups::class, ['activeTab' => 'today'])
            ->assertCanSeeTableRecords([$mine])
            ->assertCanNotSeeTableRecords([$theirs])
            ->callAction(TestAction::make('complete')->table($mine), data: ['outcome' => 'Spoke, sending details'])
            ->assertHasNoActionErrors();

        $this->assertSame(Followup::DONE, $mine->fresh()->status);
    }

    public function test_advisor_cannot_open_marketing_screens(): void
    {
        $this->actingAsVerified($this->makeStaff('business_advisor'));

        $this->get('/office/campaigns')->assertForbidden();
        $this->get('/office/vendors')->assertForbidden();
    }

    public function test_marketing_manager_manages_campaigns(): void
    {
        $this->actingAsVerified($this->makeStaff('marketing_manager'));

        Livewire::test(ManageCampaigns::class)
            ->callAction('create', data: ['name' => 'Webinar Oct', 'code' => 'webinar-oct', 'status' => 'active', 'channel' => 'webinar'])
            ->assertHasNoActionErrors();

        $this->assertDatabaseHas('campaigns', ['code' => 'webinar-oct']);
    }

    public function test_objection_scripts_need_second_person_approval_and_drafts_are_hidden_from_advisors(): void
    {
        $author = $this->makeStaff('sales_manager');
        $compliance = $this->makeStaff('compliance_admin');
        $advisor = $this->makeStaff('business_advisor');

        $this->actingAsVerified($author);
        Livewire::test(ManageObjectionScripts::class)
            ->callAction('create', data: ['objection' => 'I need to think', 'tag' => 'timing', 'response' => 'Ask what is unclear and explain the process.'])
            ->assertHasNoActionErrors();
        $script = ObjectionScript::query()->sole();
        $this->assertSame(ObjectionScript::DRAFT, $script->status);

        $this->actingAsVerified($advisor);
        Livewire::test(ManageObjectionScripts::class)->assertCanNotSeeTableRecords([$script]);

        $this->actingAsVerified($compliance);
        Livewire::test(ManageObjectionScripts::class)
            ->callAction(TestAction::make('approve')->table($script));
        $this->assertSame(ObjectionScript::APPROVED, $script->fresh()->status);

        $this->actingAsVerified($advisor);
        Livewire::test(ManageObjectionScripts::class)->assertCanSeeTableRecords([$script->fresh()]);

        // Editing an approved script sends it back to draft.
        $script->fresh()->update(['response' => 'Guaranteed profits!']);
        $this->assertSame(ObjectionScript::DRAFT, $script->fresh()->status);
    }

    public function test_session_flag_constant_is_shared_with_api(): void
    {
        $this->assertSame('auth.two_factor_passed_at', RequireTwoFactor::SESSION_KEY);
    }
}
