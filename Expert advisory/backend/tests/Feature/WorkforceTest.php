<?php

namespace Tests\Feature;

use App\Domain\Crm\LeadWorkflowService;
use App\Domain\Workforce\WorkforceClock;
use App\Filament\Resources\AttendanceDays\Pages\ManageAttendanceDays;
use App\Filament\Resources\TrainingModules\Pages\ManageTrainingModules;
use App\Models\AttendanceDay;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\SystemSetting;
use App\Models\Team;
use App\Models\TrainingModule;
use Database\Seeders\SystemSettingsSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Support\Carbon;
use Livewire\Livewire;
use Tests\TestCase;

class WorkforceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
        $this->seed(SystemSettingsSeeder::class);
    }

    private function module(array $attributes = []): TrainingModule
    {
        $module = new TrainingModule(array_merge([
            'title' => 'Compliant calling',
            'summary' => 'No return promises.',
            'body_markdown' => '# Rules',
            'is_mandatory' => true,
        ], $attributes));
        $module->forceFill(['status' => TrainingModule::DRAFT, 'version' => 1])->save();

        return $module;
    }

    private function setting(string $key, string $value): void
    {
        SystemSetting::query()->where('key', $key)->update(['value' => $value]);
    }

    public function test_pending_mandatory_training_redirects_back_office_until_completed(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $advisor = $this->makeStaff('business_advisor');
        $module = $this->module(['role_names' => ['business_advisor']]);

        $this->actingAsVerified($manager);
        Livewire::test(ManageTrainingModules::class)
            ->callAction(TestAction::make('publish')->table($module))
            ->assertHasNoActionErrors();
        $this->assertSame(TrainingModule::PUBLISHED, $module->fresh()->status);

        // The manager is not in the module's audience, so they are not blocked.
        $this->get('/office')->assertOk();

        $this->actingAsVerified($advisor);
        $this->get('/office')->assertRedirect('/office/training-modules');
        $this->get('/office/training-modules')->assertOk();

        Livewire::test(ManageTrainingModules::class)
            ->assertCanSeeTableRecords([$module])
            ->callAction(TestAction::make('complete')->table($module), data: ['confirm' => true])
            ->assertHasNoActionErrors();

        $this->get('/office')->assertOk();
    }

    public function test_changing_published_content_requires_acknowledging_the_new_version(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $module = $this->module();
        $module->forceFill(['status' => TrainingModule::PUBLISHED])->save();

        $this->actingAsVerified($advisor);
        Livewire::test(ManageTrainingModules::class)
            ->callAction(TestAction::make('complete')->table($module), data: ['confirm' => true]);
        $this->get('/office')->assertOk();

        $module->fresh()->update(['body_markdown' => '# Updated rules']);
        $this->assertSame(2, $module->fresh()->version);
        $this->get('/office')->assertRedirect('/office/training-modules');
    }

    public function test_only_training_managers_can_publish_and_non_audience_modules_are_hidden(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $draft = $this->module();
        $other = $this->module(['title' => 'Compliance only', 'role_names' => ['compliance_admin'], 'is_mandatory' => false]);
        $other->forceFill(['status' => TrainingModule::PUBLISHED])->save();

        $this->actingAsVerified($advisor);
        Livewire::test(ManageTrainingModules::class)
            ->assertCanNotSeeTableRecords([$draft, $other])
            ->assertActionHidden('create');
    }

    public function test_attendance_is_recorded_from_activity_and_scoped(): void
    {
        $team = Team::create(['name' => 'Alpha']);
        $leader = $this->makeStaff('team_leader', employee: ['team_id' => $team->id]);
        $member = $this->makeStaff('business_advisor', employee: ['team_id' => $team->id]);
        $outsider = $this->makeStaff('business_advisor');

        $clock = app(WorkforceClock::class);
        $start = Carbon::parse('2026-09-16 10:00', 'Asia/Kolkata');
        $clock->record($member, $start);
        $clock->record($member, $start->copy()->addMinutes(10));
        $clock->record($member, $start->copy()->addHours(3)); // idle gap is not counted
        $clock->record($outsider, $start);

        $day = AttendanceDay::query()->where('employee_id', $member->employee->id)->sole();
        $this->assertSame(10, $day->active_minutes);
        $this->assertSame(3, $day->requests);
        $this->assertFalse($day->outside_office_hours);

        $memberDay = $day;
        $outsiderDay = AttendanceDay::query()->where('employee_id', $outsider->employee->id)->sole();

        $this->actingAsVerified($leader);
        Livewire::test(ManageAttendanceDays::class)
            ->removeTableFilter('period')
            ->assertCanSeeTableRecords([$memberDay])
            ->assertCanNotSeeTableRecords([$outsiderDay]);

        $this->actingAsVerified($member);
        Livewire::test(ManageAttendanceDays::class)
            ->removeTableFilter('period')
            ->assertCanSeeTableRecords([$memberDay])
            ->assertCanNotSeeTableRecords([$outsiderDay]);
    }

    public function test_office_hours_enforcement_blocks_staff_but_not_admins(): void
    {
        $this->setting('workforce.enforce_office_hours', '1');
        $advisor = $this->makeStaff('business_advisor');
        $admin = $this->makeStaff('admin');
        $clock = app(WorkforceClock::class);

        $sundayNight = Carbon::parse('2026-09-20 23:00', 'Asia/Kolkata');
        $mondayMorning = Carbon::parse('2026-09-21 10:00', 'Asia/Kolkata');

        $this->assertTrue($clock->blocksAccess($advisor, $sundayNight));
        $this->assertFalse($clock->blocksAccess($advisor, $mondayMorning));
        $this->assertFalse($clock->blocksAccess($admin, $sundayNight));

        $this->travelTo($sundayNight);
        $this->actingAsVerified($advisor)->get('/office')->assertForbidden();

        $this->setting('workforce.enforce_office_hours', '0');
        $this->get('/office')->assertOk();
    }

    public function test_stale_leads_are_escalated_once_and_cleared_when_worked(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $fresh = Lead::forceCreate(['full_name' => 'Fresh', 'mobile' => '+919800000001', 'assigned_employee_id' => $advisor->employee->id]);
        $stale = Lead::forceCreate(['full_name' => 'Stale', 'mobile' => '+919800000002', 'assigned_employee_id' => $advisor->employee->id]);
        $stale->forceFill(['created_at' => now()->subHours(3)])->saveQuietly();

        $this->artisan('crm:escalate-stale-leads')->expectsOutput('Escalated 1 lead(s).')->assertSuccessful();
        $this->artisan('crm:escalate-stale-leads')->expectsOutput('Escalated 0 lead(s).');

        $this->assertNull($fresh->fresh()->escalated_at);
        $this->assertNotNull($stale->fresh()->escalated_at);
        $this->assertTrue(LeadActivity::query()->where(['lead_id' => $stale->id, 'type' => 'escalated'])->exists());
        $this->assertSame(1, $advisor->fresh()->notifications()->count());

        app(LeadWorkflowService::class)->addNote($advisor, $stale->fresh(), 'Called from another phone');
        $this->assertNull($stale->fresh()->escalated_at);
    }
}
