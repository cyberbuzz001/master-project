<?php

namespace Tests\Feature;

use App\Domain\Crm\VendorPerformanceService;
use App\Models\Campaign;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorPerformanceTest extends TestCase
{
    use RefreshDatabase;

    private VendorPerformanceService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(VendorPerformanceService::class);
    }

    public function test_vendor_metrics_aggregates_consent_replies_demos_and_conversions(): void
    {
        $vendor = Vendor::create([
            'code' => 'ALPHA_ADS',
            'name' => 'Alpha Media Lead Gen',
            'cost_per_lead' => 150.00,
        ]);

        $campaign = Campaign::create([
            'code' => 'Q4_NIFTY_SURGE',
            'name' => 'Q4 Nifty Surge Campaign',
            'vendor_id' => $vendor->id,
        ]);

        // Lead 1: Consent verified, replied, requested demo
        Lead::create([
            'full_name' => 'Sanjit Mandal',
            'mobile' => '+918014479600',
            'vendor_id' => $vendor->id,
            'campaign_id' => $campaign->id,
            'communication_state' => 'CONSENT_VERIFIED',
            'last_whatsapp_received_at' => now(),
            'demo_requested_at' => now(),
            'status' => 'FREE_TRIAL',
        ]);

        // Lead 2: Paid client
        $lead2 = Lead::create([
            'full_name' => 'Senthilkumar Thenmozhi',
            'mobile' => '+918610182030',
            'vendor_id' => $vendor->id,
            'campaign_id' => $campaign->id,
            'communication_state' => 'CONSENT_VERIFIED',
            'status' => 'PAID',
        ]);

        $client = Client::create([
            'client_code' => 'CL-SK-001',
            'lead_id' => $lead2->id,
            'full_name' => $lead2->full_name,
            'mobile' => $lead2->mobile,
        ]);

        $invoice = new Invoice([
            'client_id' => $client->id, 
            'invoice_date' => now(),
            'due_date' => now()->addDays(7),
        ]);
        $invoice->forceFill([
            'invoice_number' => 'INV-2026-0001',
            'status' => 'paid',
            'client_snapshot' => ['name' => $lead2->full_name, 'mobile' => $lead2->mobile],
        ])->save();

        $payment = new Payment([
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'amount_paise' => 1179882,
            'method' => 'gateway',
            'provider' => 'razorpay',
            'provider_reference' => 'pay_alpha_123',
            'received_at' => now(),
        ]);
        $payment->forceFill([
            'status' => 'succeeded',
            'verified_at' => now(),
        ])->save();

        // Lead 3: Cold, unnamed lead with unknown consent
        Lead::create([
            'full_name' => 'Unnamed Lead',
            'mobile' => '+919725355451',
            'vendor_id' => $vendor->id,
            'campaign_id' => $campaign->id,
            'communication_state' => 'CONSENT_UNKNOWN',
            'status' => 'NEW',
        ]);

        $metrics = $this->service->getVendorMetrics(['vendor_id' => $vendor->id]);

        $this->assertCount(1, $metrics);
        $vData = $metrics[0];

        $this->assertEquals($vendor->id, $vData['vendor_id']);
        $this->assertEquals(3, $vData['total_leads']);
        $this->assertEquals(3, $vData['valid_numbers']);
        $this->assertEquals(100.0, $vData['valid_rate']);
        $this->assertEquals(2, $vData['verified_consent']);
        $this->assertEquals(66.7, $vData['consent_rate']);
        $this->assertEquals(1, $vData['whatsapp_replies']);
        $this->assertEquals(1, $vData['demos_requested']);
        $this->assertEquals(1, $vData['paid_conversions']);
        $this->assertEquals(33.3, $vData['conversion_rate']);
        $this->assertEquals(11798.82, $vData['total_revenue_inr']);
        $this->assertEquals(450.00, $vData['total_spend']); // 3 * 150
        $this->assertGreaterThan(0, $vData['roi']);
    }
}
