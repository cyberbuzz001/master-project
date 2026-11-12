<?php

namespace Tests\Feature;

use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Crm\AutomationWorkflowEngine;
use App\Models\Lead;
use App\Models\MessageTemplate;
use App\Models\ScheduledAction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AutomationDeliveryTest extends TestCase
{
    private function schedule(): ScheduledAction
    {
        $this->travelTo(Carbon::parse('2026-11-16T05:00:00Z'));
        config(['services.whatsapp.automation_enabled' => true, 'services.whatsapp.access_token' => 'test-token', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'communication_state' => 'CONSENT_VERIFIED']);
        app(ConsentRecorder::class)->record('lead', $lead->id, 'whatsapp', true, 'test', 'Explicit WhatsApp opt-in');
        MessageTemplate::create(['author_id' => User::factory()->create()->id, 'key' => 'expert_stocks_intro_v1', 'name' => 'Intro', 'channel' => 'whatsapp', 'body' => 'Hello {{name}}', 'variables' => ['name'], 'status' => 'approved', 'provider_template_name' => 'expert_stocks_intro_v1', 'provider_status' => 'APPROVED', 'provider_checked_at' => now(), 'language_code' => 'en']);
        app(AutomationWorkflowEngine::class)->triggerWorkflow($lead, 'WORKFLOW_A_NEW_IMPORT');
        $this->travel(6)->minutes();

        return ScheduledAction::sole();
    }

    public function test_success_is_recorded_once_only_after_provider_acceptance(): void
    {
        $action = $this->schedule();
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response(['messages' => [['id' => 'wamid.accepted-once']]])]);
        $engine = app(AutomationWorkflowEngine::class);

        $this->assertSame(1, $engine->processPendingActions());
        $this->assertSame(0, $engine->processPendingActions());

        $this->assertSame('executed', $action->fresh()->status);
        $this->assertSame('wamid.accepted-once', $action->fresh()->provider_message_id);
        Http::assertSentCount(1);
    }

    public function test_ambiguous_outcome_requires_review_without_automatic_resend(): void
    {
        $action = $this->schedule();
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response([], 500)]);
        $engine = app(AutomationWorkflowEngine::class);

        $this->assertSame(0, $engine->processPendingActions());
        $this->assertSame(0, $engine->processPendingActions());

        $this->assertSame('review_required', $action->fresh()->status);
        Http::assertSentCount(1);
    }

    public function test_rate_limit_retries_later_and_then_records_acknowledgement(): void
    {
        $action = $this->schedule();
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::sequence()->push([], 429, ['Retry-After' => '120'])->push(['messages' => [['id' => 'wamid.retry-accepted']]])]);
        $engine = app(AutomationWorkflowEngine::class);

        $this->assertSame(0, $engine->processPendingActions());
        $this->assertSame('pending', $action->fresh()->status);
        $this->travel(5)->minutes();
        $this->assertSame(1, $engine->processPendingActions());

        $this->assertSame(2, $action->fresh()->attempts);
        Http::assertSentCount(2);
    }

    public function test_disabled_workflow_cancels_queued_message(): void
    {
        $action = $this->schedule();
        $action->workflowRun->workflow->update(['is_active' => false]);

        $this->assertSame(0, app(AutomationWorkflowEngine::class)->processPendingActions());

        $this->assertSame('cancelled', $action->fresh()->status);
        Http::assertNothingSent();
    }

    public function test_repeated_workflow_trigger_does_not_schedule_duplicate_intent(): void
    {
        $action = $this->schedule();

        app(AutomationWorkflowEngine::class)->triggerWorkflow($action->lead, 'WORKFLOW_A_NEW_IMPORT');

        $this->assertDatabaseCount('scheduled_actions', 1);
        Http::assertNothingSent();
    }
}
