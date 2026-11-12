<?php

namespace Tests\Feature;

use App\Domain\Ai\AiWhatsAppSalesAssistant;
use App\Models\Appointment;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\Service;
use App\Models\SuppressionRecord;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppAiSalesAssistantTest extends TestCase
{
    use RefreshDatabase;

    private AiWhatsAppSalesAssistant $assistant;

    private Lead $testLead;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.whatsapp.automation_enabled' => true, 'services.whatsapp.access_token' => 'test-token', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.graph_version' => 'v23.0', 'services.whatsapp.verify_token' => 'test-verify']);
        Http::preventStrayRequests();
        Http::fake(['https://graph.facebook.com/v23.0/123/messages' => Http::response(['messages' => [['id' => 'wamid.test']]], 200)]);
        $this->assistant = app(AiWhatsAppSalesAssistant::class);

        $this->testLead = Lead::create([
            'full_name' => 'Amit Sharma',
            'mobile' => '+919876543210',
            'status' => 'NEW',
            'communication_state' => 'CONSENT_VERIFIED',
            'country' => 'India',
        ]);
    }

    public function test_automation_disabled_still_records_inbound_and_honors_stop_without_sending(): void
    {
        config(['services.whatsapp.automation_enabled' => false]);
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'I want a free demo');
        $this->assertSame('automation_disabled', $result['status']);
        $this->assertDatabaseCount('free_trials', 0);
        $this->assertDatabaseHas('ai_conversation_messages', ['lead_id' => $this->testLead->id, 'direction' => 'inbound']);
        $this->assertSame('opted_out_suppressed', $this->assistant->handleIncomingMessage($this->testLead, 'STOP')['status']);
        Http::assertNothingSent();
    }

    /**
     * Test Meta Webhook handshake verification.
     */
    public function test_meta_webhook_challenge_handshake(): void
    {
        $response = $this->get('/api/v1/webhooks/whatsapp?hub_mode=subscribe&hub_verify_token=test-verify&hub_challenge=challenge_token_987');

        $response->assertStatus(200);
        $this->assertEquals('challenge_token_987', $response->getContent());
    }

    /**
     * Test immediate opt-out keywords (STOP, बंद करो, UNSUBSCRIBE).
     */
    public function test_opt_out_immediately_suppresses_contact_and_stops_ai(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'STOP');

        $this->assertEquals('opted_out_suppressed', $result['status']);

        // Verify lead is marked opted out and DND
        $this->testLead->refresh();
        $this->assertEquals('OPTED_OUT', $this->testLead->communication_state);
        $this->assertEquals('DND', $this->testLead->status);
        $this->assertTrue($this->testLead->is_ai_paused);
        $this->assertNotNull($this->testLead->whatsapp_opted_out_at);

        // Verify Centralized Suppression Record
        $this->assertTrue(SuppressionRecord::isSuppressed('+919876543210', null, 'whatsapp'));
    }

    /**
     * Test Option 1: Free Demo Request.
     */
    public function test_option_1_free_demo_booking(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'I want to try your free demo');

        $this->assertEquals('replied', $result['status']);
        $this->assertEquals('WANTS_FREE_DEMO', $result['intent']);
        $this->assertEquals('DEMO_REQUESTED', $result['next_state']);
        $this->assertStringContainsString('Complimentary Research Demo', $result['reply_text']);

        // Verify FreeTrial is created
        $trial = FreeTrial::where('lead_id', $this->testLead->id)->first();
        $this->assertNotNull($trial);
        $this->assertEquals('requested', $trial->status);
        $this->assertTrue(str_starts_with($trial->trial_code, 'DEMO-'));

        $this->testLead->refresh();
        $this->assertEquals('NEW', $this->testLead->status);
        $this->assertNotNull($this->testLead->demo_requested_at);
    }

    /**
     * Test Option 2: Appointment Booking.
     */
    public function test_option_2_appointment_booking(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'Can I schedule a call with your advisor?');

        $this->assertEquals('replied', $result['status']);
        $this->assertEquals('WANTS_APPOINTMENT', $result['intent']);
        $this->assertEquals('APPOINTMENT_REQUESTED', $result['next_state']);
        $this->assertStringContainsString('appointment request has been received', $result['reply_text']);

        // Verify Appointment record created
        $apt = Appointment::where('lead_id', $this->testLead->id)->first();
        $this->assertNotNull($apt);
        $this->assertEquals('requested', $apt->status);
        $this->assertTrue(str_starts_with($apt->appointment_code, 'APT-'));

        $this->testLead->refresh();
        $this->assertEquals('CALL_BACK', $this->testLead->status);
        $this->assertNotNull($this->testLead->appointment_requested_at);
    }

    /**
     * Test Option 3: Package Pricing & Secure Payment Link.
     */
    public function test_option_3_pricing_packages_and_payment_link(): void
    {
        // Seed a published plan
        $service = Service::create([
            'code' => 'EQUITY_RESEARCH',
            'name' => 'Equity Momentum Research',
            'category' => 'research',
        ]);

        $plan = Plan::create([
            'service_id' => $service->id,
            'code' => 'EQ_MOM_M',
            'name' => 'Monthly Momentum Advisory',
            'billing_cycle' => 'monthly',
            'duration_days' => 30,
        ]);

        $author = User::factory()->create();
        PlanVersion::create([
            'plan_id' => $plan->id,
            'version' => 1,
            'base_price_paise' => 999900, // 9,999 INR
            'status' => PlanVersion::PUBLISHED,
            'created_by' => $author->id,
            'published_by' => $author->id,
            'published_at' => now(),
        ]);

        $result = $this->assistant->handleIncomingMessage($this->testLead, 'What are your plan charges and fees?');

        $this->assertEquals('replied', $result['status']);
        $this->assertEquals('WANTS_PRICING_PACKAGES', $result['intent']);
        $this->assertEquals('PAYMENT_LINK_SENT', $result['next_state']);
        $this->assertStringContainsString('9,999.00', $result['reply_text']);
        $this->assertStringContainsString('https://expertstocks.in/portal/pay/', $result['reply_text']);
        $this->assertStringContainsString('SEBI (Research Analysts) Regulations', $result['reply_text']);

        $this->testLead->refresh();
        $this->assertEquals('EXPECTED_PAYMENT', $this->testLead->status);
        $this->assertNotNull($this->testLead->payment_link_generated_at);
    }

    /**
     * Test Option 4: Human Agent Handoff & Mutual Exclusion Lockout.
     */
    public function test_option_4_human_agent_handoff_locks_out_ai(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'I want to speak with a human executive');

        $this->assertEquals('replied', $result['status']);
        $this->assertEquals('REQUESTS_HUMAN_AGENT', $result['intent']);
        $this->assertEquals('HUMAN_AGENT_REQUESTED', $result['next_state']);
        $this->assertStringContainsString('Automated AI responses have been paused', $result['reply_text']);

        // Verify AI Lockout
        $this->testLead->refresh();
        $this->assertTrue($this->testLead->is_ai_paused);
        $this->assertNotNull($this->testLead->human_handoff_requested_at);

        // Verify High-Priority Task created
        $task = Task::where('priority', 'high')->where('status', 'open')->first();
        $this->assertNotNull($task);
        $this->assertStringContainsString('Immediate WhatsApp Takeover', $task->title);

        // Subsequent message while human takeover is active must NOT trigger AI response
        $subsequentResult = $this->assistant->handleIncomingMessage($this->testLead, 'Hello are you there?');
        $this->assertEquals('human_agent_active', $subsequentResult['status']);
    }

    /**
     * Test Hindi language response when user writes in Hindi / Devanagari.
     */
    public function test_responds_in_hindi_when_hindi_input_provided(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'मुझे आपका फ्री डेमो चाहिए');

        $this->assertEquals('replied', $result['status']);
        $this->assertEquals('WANTS_FREE_DEMO', $result['intent']);
        $this->assertStringContainsString('रिसर्च डेमो', $result['reply_text']);
        $this->assertStringContainsString('अनुरोध मिला है', $result['reply_text']);
    }

    /**
     * Test Compliance Grounding strips prohibited guaranteed return promises.
     */
    public function test_compliance_guardian_strips_guaranteed_return_claims(): void
    {
        $result = $this->assistant->handleIncomingMessage($this->testLead, 'Do you give guaranteed returns?');

        $this->assertStringNotContainsString('guaranteed returns', mb_strtolower($result['reply_text']));
        $this->assertStringContainsString('statutory', mb_strtolower($result['reply_text']));
    }
}
