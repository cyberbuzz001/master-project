<?php

namespace Tests\Feature;

use App\Domain\Communications\WhatsAppService;
use App\Domain\Compliance\ConsentRecorder;
use App\Models\Lead;
use App\Models\MessageTemplate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppDeliverySecurityTest extends TestCase
{
    private function configuredProvider(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12T05:00:00Z'));
        config(['services.whatsapp.access_token' => 'test-token', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
    }

    private function lead(): Lead
    {
        return Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'communication_state' => 'CONSENT_VERIFIED', 'last_whatsapp_received_at' => now()]);
    }

    private function template(): MessageTemplate
    {
        return MessageTemplate::create(['author_id' => User::factory()->create()->id, 'key' => 'trial_intro', 'name' => 'Trial intro', 'channel' => 'whatsapp', 'body' => 'Hello {{name}}', 'variables' => ['name'], 'status' => 'approved', 'provider_template_name' => 'trial_intro', 'provider_status' => 'APPROVED', 'provider_checked_at' => now(), 'language_code' => 'en']);
    }

    public function test_missing_credentials_never_report_sent(): void
    {
        $this->configuredProvider();
        config(['services.whatsapp.access_token' => null]);
        $lead = $this->lead();

        $result = app(WhatsAppService::class)->sendText($lead->mobile, 'Hello', $lead);

        $this->assertFalse($result['success']);
        $this->assertSame('provider_not_configured', $result['status']);
        $this->assertNull($result['provider_message_id']);
        Http::assertNothingSent();
    }

    public function test_freeform_requires_a_matching_recipient_and_unexpired_inbound_window(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        $lead->update(['last_whatsapp_received_at' => now()->subHours(24)]);

        $result = app(WhatsAppService::class)->sendText($lead->mobile, 'Hello', $lead);

        $this->assertSame('window_expired', $result['status']);
        Http::assertNothingSent();
    }

    public function test_latest_consent_revocation_blocks_template_even_when_lead_state_says_verified(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        $this->template();
        $consents = app(ConsentRecorder::class);
        $consents->record('lead', $lead->id, 'whatsapp', true, 'test', 'Initial permission');
        $consents->record('lead', $lead->id, 'whatsapp', false, 'test', 'Permission withdrawn');

        $result = app(WhatsAppService::class)->sendTemplate($lead->mobile, 'trial_intro', ['Nina'], $lead);

        $this->assertSame('consent_refused', $result['status']);
        $this->assertDatabaseHas('message_logs', ['status' => 'consent_refused', 'consent_verified' => false]);
        Http::assertNothingSent();
    }

    public function test_provider_acknowledgement_is_accepted_not_delivered(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        $this->template();
        app(ConsentRecorder::class)->record('lead', $lead->id, 'whatsapp', true, 'test', 'Explicit permission');
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response(['messages' => [['id' => 'wamid.test-accepted']]], 200)]);

        $result = app(WhatsAppService::class)->sendTemplate($lead->mobile, 'trial_intro', ['Nina'], $lead);

        $this->assertTrue($result['success']);
        $this->assertSame('accepted', $result['status']);
        $this->assertDatabaseHas('message_logs', ['provider_message_id' => 'wamid.test-accepted', 'status' => 'accepted']);
        Http::assertSentCount(1);
    }

    public function test_success_response_without_message_id_requires_reconciliation(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response([], 200)]);

        $result = app(WhatsAppService::class)->sendText($lead->mobile, 'Hello', $lead);

        $this->assertFalse($result['success']);
        $this->assertSame('review_required', $result['status']);
        Http::assertSentCount(1);
    }

    public function test_stale_meta_approval_blocks_dispatch(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        $this->template()->update(['provider_checked_at' => now()->subDays(2)]);
        app(ConsentRecorder::class)->record('lead', $lead->id, 'whatsapp', true, 'test', 'Explicit permission');

        $result = app(WhatsAppService::class)->sendTemplate($lead->mobile, 'trial_intro', ['Nina'], $lead);

        $this->assertSame('template_unapproved', $result['status']);
        Http::assertNothingSent();
    }

    public function test_rate_limit_is_not_reported_as_success_or_retried_inline(): void
    {
        $this->configuredProvider();
        $lead = $this->lead();
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response(['error' => ['code' => 130429]], 429, ['Retry-After' => '120'])]);

        $result = app(WhatsAppService::class)->sendText($lead->mobile, 'Hello', $lead);

        $this->assertFalse($result['success']);
        $this->assertSame('rate_limited', $result['status']);
        $this->assertSame(120, $result['retry_after']);
        Http::assertSentCount(1);
    }
}
