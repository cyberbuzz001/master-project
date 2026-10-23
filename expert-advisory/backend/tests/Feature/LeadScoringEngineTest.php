<?php

namespace Tests\Feature;

use App\Domain\Crm\LeadScoringEngine;
use App\Models\Lead;
use App\Models\SuppressionRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeadScoringEngineTest extends TestCase
{
    use RefreshDatabase;

    private LeadScoringEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = app(LeadScoringEngine::class);
    }

    public function test_suppressed_or_opted_out_lead_scores_zero_and_disqualified(): void
    {
        $lead = Lead::create([
            'full_name' => 'Koushik Duley',
            'mobile' => '+916295046566',
            'status' => 'DND',
            'communication_state' => 'OPTED_OUT',
        ]);

        $result = $this->engine->scoreLead($lead);

        $this->assertEquals(0, $result['score']);
        $this->assertEquals('DISQUALIFIED', $result['grade']);
        $this->assertEquals(0.0, $result['conversion_probability']);
        $this->assertStringContainsString('disqualified', $result['explanation'][0]);
    }

    public function test_paid_lead_scores_hundred_and_converted(): void
    {
        $lead = Lead::create([
            'full_name' => 'Attada Prasad',
            'mobile' => '+919912829401',
            'status' => 'PAID',
            'communication_state' => 'CONSENT_VERIFIED',
        ]);

        $result = $this->engine->scoreLead($lead);

        $this->assertEquals(100, $result['score']);
        $this->assertEquals('CONVERTED', $result['grade']);
        $this->assertEquals(1.0, $result['conversion_probability']);
    }

    public function test_observable_engagement_and_demo_request_calculates_warm_or_hot(): void
    {
        $lead = Lead::create([
            'full_name' => 'Rohit Kumar Singh',
            'mobile' => '+917209390622',
            'city' => 'Ranchi',
            'trading_experience' => '3-5 years',
            'communication_state' => 'CONSENT_VERIFIED',
            'last_whatsapp_received_at' => now(),
            'demo_requested_at' => now(),
            'ai_conversation_state' => 'DEMO_BOOKED',
            'status' => 'FREE_TRIAL',
        ]);

        $result = $this->engine->scoreLead($lead);

        // Expected points:
        // Mobile: +10, Name: +5, City: +5, Experience: +5 = 25
        // Consent: +15
        // WA received: +15
        // Demo: +20
        // Total = 75 (HOT)
        $this->assertGreaterThanOrEqual(70, $result['score']);
        $this->assertEquals('HOT', $result['grade']);
        $this->assertGreaterThanOrEqual(0.70, $result['conversion_probability']);
        $this->assertNotEmpty($result['explanation']);
    }
}
