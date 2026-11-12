<?php

namespace Tests\Feature;

use App\Domain\Communications\WhatsAppInboxService;
use App\Models\AiConversation;
use App\Models\Lead;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class WhatsAppInboxTest extends TestCase
{
    public function test_assigned_agent_reply_pauses_ai_and_replays_do_not_resend(): void
    {
        $actor = $this->makeStaff('business_advisor');
        $lead = Lead::forceCreate(['full_name' => 'Inbox client', 'mobile' => '+919876543210', 'assigned_employee_id' => $actor->employee->id, 'last_whatsapp_received_at' => now(), 'communication_state' => 'CONSENT_VERIFIED']);
        $conversation = AiConversation::create(['lead_id' => $lead->id, 'channel' => 'whatsapp']);
        config(['services.whatsapp.access_token' => 'test', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.graph_version' => 'v23.0']);
        Http::preventStrayRequests();
        Http::fake(['https://graph.facebook.com/v23.0/123/messages' => Http::response(['messages' => [['id' => 'wamid.inbox']]])]);
        $key = (string) Str::uuid();
        $service = app(WhatsAppInboxService::class);
        $message = $service->reply($actor, $conversation, 'Your request is being reviewed.', $key);
        $replay = $service->reply($actor, $conversation, 'Your request is being reviewed.', $key);
        $this->assertSame($message->id, $replay->id);
        $this->assertSame('accepted', $message->delivery_status);
        $this->assertSame($actor->id, $message->sender_user_id);
        $this->assertTrue($lead->fresh()->is_ai_paused);
        Http::assertSentCount(1);
    }

    public function test_other_agents_cannot_reply_to_unassigned_conversation(): void
    {
        $actor = $this->makeStaff('business_advisor');
        $owner = $this->makeStaff('business_advisor');
        $lead = Lead::forceCreate(['full_name' => 'Other client', 'mobile' => '+919876543210', 'assigned_employee_id' => $owner->employee->id]);
        $conversation = AiConversation::create(['lead_id' => $lead->id, 'channel' => 'whatsapp']);
        Http::preventStrayRequests();
        $this->expectException(AuthorizationException::class);
        app(WhatsAppInboxService::class)->reply($actor, $conversation, 'Unauthorized reply', (string) Str::uuid());
    }

    public function test_expired_service_window_refuses_human_reply(): void
    {
        $actor = $this->makeStaff('business_advisor');
        $lead = Lead::forceCreate(['full_name' => 'Window expired', 'mobile' => '+919876543210', 'assigned_employee_id' => $actor->employee->id, 'last_whatsapp_received_at' => now()->subHours(25)]);
        $conversation = AiConversation::create(['lead_id' => $lead->id, 'channel' => 'whatsapp']);
        Http::preventStrayRequests();
        $message = app(WhatsAppInboxService::class)->reply($actor, $conversation, 'Cannot send this yet', (string) Str::uuid());
        $this->assertSame('window_expired', $message->delivery_status);
        Http::assertNothingSent();
    }
}
