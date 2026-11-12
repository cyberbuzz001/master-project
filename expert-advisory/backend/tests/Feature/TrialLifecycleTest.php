<?php

namespace Tests\Feature;

use App\Domain\Crm\TrialLifecycleService;
use App\Models\Lead;
use App\Models\ScheduledAction;
use Carbon\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TrialLifecycleTest extends TestCase
{
    public function test_agent_can_request_owned_demo_but_cannot_approve_activation(): void
    {
        $this->travelTo(Carbon::parse('2026-11-16T05:00:00Z'));
        $agent = $this->makeStaff('business_advisor');
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'assigned_employee_id' => $agent->employee->id]);
        $service = app(TrialLifecycleService::class);

        $trial = $service->request($agent, ['lead_id' => $lead->id, 'trial_type' => 'index_options', ...$service->defaultDates()]);

        $this->assertSame('requested', $trial->status);
        $this->assertNull($trial->approved_by);
        $this->assertFalse(Gate::forUser($agent)->allows('approve', $trial));
        $this->assertDatabaseCount('scheduled_actions', 0);
        $this->assertSame('NEW', $lead->fresh()->status);
    }

    public function test_approved_demo_activates_once_with_first_session_review_and_staff_task(): void
    {
        $this->travelTo(Carbon::parse('2026-11-16T05:00:00Z'));
        $manager = $this->makeStaff('sales_manager');
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'assigned_employee_id' => $manager->employee->id]);
        $service = app(TrialLifecycleService::class);
        $trial = $service->request($manager, ['lead_id' => $lead->id, 'trial_type' => 'index_options', ...$service->defaultDates()]);
        Http::preventStrayRequests();

        $service->approve($manager, $trial);
        $service->activateApprovedTrials();

        $this->assertSame('active', $trial->fresh()->status);
        $this->assertSame($manager->id, $trial->fresh()->approved_by);
        $this->assertDatabaseCount('scheduled_actions', 2);
        $this->assertDatabaseCount('tasks', 1);
        $review = ScheduledAction::where('action_type', 'send_trial_review')->sole();
        $this->assertSame('15:45', $review->scheduled_for->timezone('Asia/Kolkata')->format('H:i'));
        Http::assertNothingSent();
    }

    public function test_weekends_and_configured_holidays_do_not_count_as_trial_sessions(): void
    {
        $this->travelTo(Carbon::parse('2026-11-13T16:00:00Z'));
        config(['crm.trading_holidays' => ['2026-11-16']]);
        $manager = $this->makeStaff('sales_manager');
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW']);
        $service = app(TrialLifecycleService::class);
        $dates = $service->defaultDates();
        $trial = $service->request($manager, ['lead_id' => $lead->id, 'trial_type' => 'index_options', ...$dates]);

        $service->approve($manager, $trial);

        $this->assertSame('2026-11-17', $dates['start_date']);
        $this->assertSame('2026-11-18', $dates['end_date']);
        $this->assertSame('approved', $trial->fresh()->status);
        $this->assertDatabaseCount('scheduled_actions', 0);
        $this->travelTo(Carbon::parse('2026-11-17T04:00:00Z'));
        $this->assertSame(1, $service->activateApprovedTrials());
        $this->assertDatabaseCount('scheduled_actions', 2);
    }

    public function test_cancellation_stops_pending_trial_messages(): void
    {
        $this->travelTo(Carbon::parse('2026-11-16T05:00:00Z'));
        $manager = $this->makeStaff('sales_manager');
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW']);
        $service = app(TrialLifecycleService::class);
        $trial = $service->request($manager, ['lead_id' => $lead->id, 'trial_type' => 'index_options', ...$service->defaultDates()]);
        $service->approve($manager, $trial);

        $service->cancel($manager, $trial->fresh(), 'Client requested cancellation');

        $this->assertSame('cancelled', $trial->fresh()->status);
        $this->assertSame(0, ScheduledAction::where('status', 'pending')->count());
        $this->assertSame(2, ScheduledAction::where('status', 'cancelled')->count());
    }
}
