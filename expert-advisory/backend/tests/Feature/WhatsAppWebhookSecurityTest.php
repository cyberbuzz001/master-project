<?php

namespace Tests\Feature;

use App\Domain\Communications\WhatsAppService;
use App\Domain\Communications\WhatsAppWebhookProcessor;
use App\Jobs\ProcessWhatsAppWebhook;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\WebhookEvent;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class WhatsAppWebhookSecurityTest extends TestCase
{
    private function configure(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12T05:00:00Z'));
        config(['services.whatsapp.app_secret' => 'test-app-secret', 'services.whatsapp.business_account_id' => '456', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.verify_token' => 'test-verify']);
    }

    private function payload(): array
    {
        return ['object' => 'whatsapp_business_account', 'entry' => [['id' => '456', 'changes' => [['value' => ['metadata' => ['phone_number_id' => '123'], 'messages' => [['id' => 'wamid.inbound-test', 'from' => '919876543210', 'timestamp' => (string) now()->getTimestamp(), 'type' => 'text', 'text' => ['body' => 'Need help']]]]]]]]];
    }

    private function sendPayload(array $payload, ?string $signature = null): TestResponse
    {
        $raw = json_encode($payload, JSON_THROW_ON_ERROR);

        return $this->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => $signature ?? 'sha256='.hash_hmac('sha256', $raw, 'test-app-secret')], $raw);
    }

    public function test_missing_webhook_configuration_returns_503_without_processing(): void
    {
        Queue::fake([ProcessWhatsAppWebhook::class]);
        config(['services.whatsapp.app_secret' => null]);

        $this->sendPayload($this->payload())->assertStatus(503);

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('webhook_events', 0);
    }

    public function test_invalid_signature_returns_401_before_creating_leads(): void
    {
        $this->configure();
        Queue::fake([ProcessWhatsAppWebhook::class]);

        $this->sendPayload($this->payload(), 'sha256='.str_repeat('0', 64))->assertUnauthorized();

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('leads', 0);
        $this->assertDatabaseCount('webhook_events', 0);
    }

    public function test_wrong_waba_returns_403_even_with_valid_signature(): void
    {
        $this->configure();
        Queue::fake([ProcessWhatsAppWebhook::class]);
        $payload = $this->payload();
        $payload['entry'][0]['id'] = '999';

        $this->sendPayload($payload)->assertForbidden();

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('webhook_events', 0);
    }

    public function test_replayed_message_is_processed_only_once_by_duplicate_jobs(): void
    {
        $this->configure();
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'is_ai_paused' => true]);
        Queue::fake([ProcessWhatsAppWebhook::class]);
        Http::preventStrayRequests();

        $this->sendPayload($this->payload())->assertOk();
        $payload = $this->payload();
        $payload['entry'][0]['changes'][0]['value']['contacts'] = [['profile' => ['name' => 'Changed contact metadata']]];
        $this->sendPayload($payload)->assertOk();
        $event = WebhookEvent::sole();
        $job = new ProcessWhatsAppWebhook($event->id);
        $job->handle(app(WhatsAppWebhookProcessor::class));
        $job->handle(app(WhatsAppWebhookProcessor::class));

        $this->assertDatabaseCount('webhook_events', 1);
        $this->assertDatabaseCount('ai_conversation_messages', 1);
        $this->assertSame(WebhookEvent::PROCESSED, $event->fresh()->status);
        $this->assertSame('Nina', $lead->fresh()->full_name);
        Queue::assertPushed(ProcessWhatsAppWebhook::class, 2);
        Http::assertNothingSent();
    }

    public function test_status_events_cannot_regress_read_to_delivered_or_sent(): void
    {
        $this->configure();
        $log = MessageLog::create(['channel' => 'whatsapp', 'recipient_type' => 'lead', 'rendered_body' => 'Test message', 'consent_verified' => true, 'status' => 'accepted', 'provider_message_id' => 'wamid.outbound-test']);
        $processor = app(WhatsAppWebhookProcessor::class);
        foreach ([['read', -10], ['delivered', -20], ['sent', -5]] as [$status,$offset]) {
            $event = WebhookEvent::create(['provider' => 'whatsapp', 'event_id' => 'fixture-'.$status, 'event_type' => 'status', 'signature_valid' => true, 'payload' => ['status' => ['id' => 'wamid.outbound-test', 'status' => $status, 'timestamp' => now()->getTimestamp() + $offset]]]);
            $processor->process($event);
        }

        $this->assertSame('read', $log->fresh()->status);
    }

    public function test_stale_inbound_event_does_not_reopen_customer_service_window(): void
    {
        $this->configure();
        $lead = Lead::create(['full_name' => 'Nina', 'mobile' => '+919876543210', 'status' => 'NEW', 'is_ai_paused' => true]);
        $payload = $this->payload();
        $message = $payload['entry'][0]['changes'][0]['value']['messages'][0];
        $message['timestamp'] = now()->subDays(2)->getTimestamp();
        $event = WebhookEvent::create(['provider' => 'whatsapp', 'event_id' => 'stale-fixture', 'event_type' => 'message', 'signature_valid' => true, 'payload' => ['message' => $message, 'contacts' => []]]);
        Http::preventStrayRequests();

        (new ProcessWhatsAppWebhook($event->id))->handle(app(WhatsAppWebhookProcessor::class));

        $this->assertFalse(app(WhatsAppService::class)->isInsideCustomerServiceWindow($lead->fresh()));
        Http::assertNothingSent();
    }

    public function test_handshake_requires_explicit_verify_token(): void
    {
        $this->configure();
        $this->get('/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=123')->assertOk()->assertContent('123');
        $this->get('/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123')->assertForbidden();
    }
}
