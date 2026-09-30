<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\ConsentRecord;
use App\Models\Lead;
use Database\Seeders\LeadSourceSeeder;
use Tests\TestCase;

class LeadIntakeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(LeadSourceSeeder::class);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'full_name' => 'Ravi Kumar',
            'mobile' => '98765 43210',
            'email' => 'Ravi@Example.test',
            'city' => 'Pune',
            'form_key' => 'talk_to_team',
            'segments' => ['equity', 'options'],
            'consents' => ['data_processing' => true, 'calls' => true, 'whatsapp' => false],
            'attribution' => [
                'utm_source' => 'google', 'utm_medium' => 'cpc', 'utm_campaign' => 'sep-risk-webinar',
                'landing_page' => 'https://expertstocks.in/risk-assessment?utm_source=google',
            ],
        ], $overrides);
    }

    public function test_lead_is_captured_with_attribution_consent_and_history(): void
    {
        Campaign::create(['code' => 'sep-risk-webinar', 'name' => 'Webinar']);

        $this->postJson('/api/v1/public/leads', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.received', true);

        $lead = Lead::query()->with(['source', 'campaign', 'attributions', 'statusHistory'])->sole();

        $this->assertSame('+919876543210', $lead->mobile);
        $this->assertSame('ravi@example.test', $lead->email);
        $this->assertSame('NEW', $lead->status);
        $this->assertSame('google_ads', $lead->source->code);
        $this->assertSame('sep-risk-webinar', $lead->campaign->code);
        $this->assertTrue($lead->equity_interest && $lead->options_interest);
        $this->assertSame('cpc', $lead->attributions->sole()->utm_medium);
        $this->assertTrue($lead->attributions->sole()->is_first_touch);
        $this->assertSame('NEW', $lead->statusHistory->sole()->to_status);

        $consents = ConsentRecord::query()->where('subject_id', $lead->id)->pluck('granted', 'purpose');
        $this->assertTrue($consents['data_processing']);
        $this->assertTrue($consents['calls']);
        $this->assertFalse($consents['whatsapp']);
        $this->assertFalse($consents['marketing_email']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'lead.captured', 'subject_id' => $lead->id, 'actor_type' => 'system']);
    }

    public function test_data_processing_consent_is_required(): void
    {
        $response = $this->postJson('/api/v1/public/leads', $this->payload(['consents' => ['data_processing' => false]]));

        $this->assertApiError($response, 422, 'VALIDATION_FAILED');
        $response->assertJsonStructure(['errors' => ['consents.data_processing']]);
        $this->assertSame(0, Lead::query()->count());
    }

    public function test_invalid_mobile_is_rejected(): void
    {
        $this->assertApiError($this->postJson('/api/v1/public/leads', $this->payload(['mobile' => '12345'])), 422, 'VALIDATION_FAILED');
    }

    public function test_honeypot_submission_is_accepted_silently_and_not_stored(): void
    {
        $this->postJson('/api/v1/public/leads', $this->payload(['website' => 'http://spam.test']))
            ->assertCreated()
            ->assertJsonPath('data.received', true);

        $this->assertSame(0, Lead::query()->count());
    }

    public function test_duplicate_is_linked_and_response_does_not_reveal_it(): void
    {
        $first = $this->postJson('/api/v1/public/leads', $this->payload())->assertCreated();
        $second = $this->postJson('/api/v1/public/leads', $this->payload(['email' => 'other@example.test', 'mobile' => '+91 98765-43210']))->assertCreated();

        $this->assertSame($first->json('data'), $second->json('data'));

        [$original, $duplicate] = Lead::query()->orderBy('id')->get()->all();
        $this->assertNull($original->duplicate_of_lead_id);
        $this->assertSame($original->id, $duplicate->duplicate_of_lead_id);
    }

    public function test_public_form_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/public/leads', $this->payload(['mobile' => '98765432'.sprintf('%02d', $i)]))->assertCreated();
        }

        $this->assertApiError($this->postJson('/api/v1/public/leads', $this->payload()), 429, 'RATE_LIMITED');
    }

    public function test_vendor_code_sets_vendor_source(): void
    {
        \App\Models\Vendor::create(['code' => 'vendor-a', 'name' => 'Vendor A']);

        $this->postJson('/api/v1/public/leads', $this->payload(['attribution' => ['vendor_code' => 'vendor-a']]))->assertCreated();

        $lead = Lead::query()->with(['source', 'vendor'])->sole();
        $this->assertSame('vendor_feed', $lead->source->code);
        $this->assertSame('vendor-a', $lead->vendor->code);
    }
}
