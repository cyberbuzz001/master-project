<?php

namespace Tests\Feature;

use App\Domain\Billing\InvoiceService;
use App\Domain\Billing\Money;
use App\Domain\Billing\NumberSeries;
use App\Domain\Billing\PaymentService;
use App\Domain\Billing\SubscriptionService;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Shared\ApiException;
use App\Models\Agreement;
use App\Models\AgreementAcceptance;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\Receipt;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\Subscription;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Tests\TestCase;

class BillingTest extends TestCase
{
    private function plan(int $pricePaise = 1_180_000, string $taxCode = 'gst_18', string $cycle = 'quarterly'): PlanVersion
    {
        $service = Service::create(['code' => 'equity-research', 'name' => 'Equity research', 'category' => 'research']);
        $plan = Plan::create([
            'service_id' => $service->id, 'code' => 'equity-q', 'name' => 'Quarterly',
            'billing_cycle' => $cycle, 'duration_days' => Plan::CYCLES[$cycle]['days'],
        ]);

        $version = new PlanVersion([
            'plan_id' => $plan->id, 'version' => 1, 'base_price_paise' => $pricePaise, 'tax_code' => $taxCode,
        ]);
        $version->save();
        $version->forceFill(['status' => PlanVersion::PUBLISHED, 'published_at' => now()])->save();

        return $version->fresh()->load('plan.service');
    }

    /**
     * A client whose onboarding is genuinely complete, so a service may be sold. The evidence the
     * checklist derives from is created directly — onboarding itself is covered by OnboardingTest.
     */
    private function onboardedClient(): Client
    {
        $client = Client::create([
            'client_code' => 'ESC-2026-0'.random_int(1000, 9999),
            'full_name' => 'Ravi Menon',
            'email' => 'ravi@example.test',
            'mobile' => '+919800001111',
            'state' => 'Kerala',
        ]);

        $agreement = Agreement::create(['code' => 'client_agreement-'.$client->id, 'title' => 'Client service agreement']);
        $version = new AgreementVersion(['agreement_id' => $agreement->id, 'version' => 1, 'body_markdown' => 'Terms']);
        $version->save();
        $version->forceFill(['status' => AgreementVersion::PUBLISHED, 'approved_at' => now(), 'published_at' => now()])->save();

        $acceptance = new AgreementAcceptance;
        $acceptance->forceFill([
            'client_id' => $client->id, 'agreement_version_id' => $version->id, 'method' => 'portal',
            'evidence_sha256' => str_repeat('a', 64), 'accepted_at' => now(),
        ])->save();

        foreach ((array) config('onboarding.kyc.required_types') as $type) {
            KycCheck::create(['client_id' => $client->id, 'type' => $type])
                ->forceFill(['status' => KycCheck::VERIFIED, 'verified_at' => now()])->save();
        }

        $questionnaire = RiskQuestionnaire::create(['code' => 'suitability-'.$client->id, 'title' => 'Suitability']);
        $questionnaireVersion = new RiskQuestionnaireVersion([
            'risk_questionnaire_id' => $questionnaire->id, 'version' => 1, 'methodology_version' => 'test-1.0',
            'bands' => [['key' => 'balanced', 'label' => 'Balanced', 'min_score' => 0, 'max_score' => 100]],
        ]);
        $questionnaireVersion->save();

        $profile = new RiskProfile;
        $profile->forceFill([
            'client_id' => $client->id, 'risk_questionnaire_version_id' => $questionnaireVersion->id,
            'raw_score' => 10, 'max_score' => 20, 'methodology_version' => 'test-1.0', 'risk_category' => 'balanced',
            'status' => RiskProfile::FINALIZED, 'answers_sha256' => str_repeat('b', 64), 'acknowledged_at' => now(),
            'finalized_at' => now(),
        ])->save();

        $onboarding = app(OnboardingService::class);
        $onboarding->startChecklist($client);
        OnboardingStep::query()
            ->where('client_id', $client->id)
            ->whereNotIn('key', ['profile', 'agreements', 'kyc', 'risk_profile'])
            ->update(['status' => OnboardingStep::COMPLETED, 'completed_at' => now()]);

        $client->forceFill(['risk_profile_id' => $profile->id, 'kyc_status' => 'verified'])->save();
        $this->assertSame([], $onboarding->outstanding($client->fresh()), 'The test client should be fully onboarded.');

        return $client->fresh();
    }

    public function test_money_arithmetic_is_exact_and_formats_in_indian_grouping(): void
    {
        $price = Money::rupees(11800);

        $this->assertSame(1_180_000, $price->paise);
        $this->assertSame(212_400, $price->percentage(18)->paise);
        $this->assertSame('₹11,800.00', $price->format());
        $this->assertSame('₹1,23,456.78', Money::paise(12_345_678)->format());
        // Half-up, stated explicitly rather than left to the platform.
        $this->assertSame(1, Money::paise(1)->percentage(50)->paise);
        $this->assertSame(0, Money::paise(1)->percentage(49)->paise);
        $this->assertTrue(Money::rupees('0.01')->equals(Money::paise(1)));
    }

    public function test_invoice_totals_are_calculated_from_the_stored_price(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $invoices = app(InvoiceService::class);

        $invoice = $invoices->draft($manager, $client, [
            ['plan_version_id' => $version->id],
            ['description' => 'Onboarding assistance', 'unit_price_paise' => 100_000, 'discount_paise' => 20_000, 'tax_code' => 'gst_18'],
        ]);

        // 11,800 + (1,000 − 200) = 12,600 taxable; 18% = 2,268; total 14,868.
        $this->assertSame(1_280_000, (int) $invoice->subtotal_paise);
        $this->assertSame(20_000, (int) $invoice->discount_total_paise);
        $this->assertSame(226_800, (int) $invoice->tax_total_paise);
        $this->assertSame(1_486_800, (int) $invoice->grand_total_paise);
        $this->assertSame('₹14,868.00', $invoice->grandTotal()->format());
        $this->assertSame(Invoice::DRAFT, $invoice->status);
        $this->assertStringStartsWith('DRAFT-', $invoice->invoice_number);

        $invoices->issue($manager, $invoice);
        $invoice->refresh();

        $this->assertSame(Invoice::ISSUED, $invoice->status);
        $this->assertStringStartsWith('INV/'.NumberSeries::financialYear(now()).'/', $invoice->invoice_number);
        $this->assertSame($client->client_code, $invoice->client_snapshot['client_code']);

        // Issued invoices are frozen.
        $this->expectException(LogicException::class);
        $invoice->forceFill(['grand_total_paise' => 1])->save();
    }

    public function test_invoice_numbers_are_sequential_and_gap_free_per_financial_year(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $invoices = app(InvoiceService::class);

        $numbers = collect(range(1, 3))->map(function () use ($invoices, $manager, $client, $version) {
            $invoice = $invoices->draft($manager, $client, [['plan_version_id' => $version->id]]);

            return $invoices->issue($manager, $invoice)->invoice_number;
        });

        $year = NumberSeries::financialYear(now());
        $this->assertSame([
            "INV/{$year}/00001", "INV/{$year}/00002", "INV/{$year}/00003",
        ], $numbers->all());

        // A new financial year restarts the series.
        $next = Carbon::create((int) substr($year, 0, 4) + 1, 6, 1);
        $this->assertSame('INV/'.NumberSeries::financialYear($next).'/00001', NumberSeries::next('invoice', $next));
    }

    public function test_a_service_only_starts_once_a_verified_payment_settles_the_invoice(): void
    {
        $advisor = $this->makeStaff('senior_business_advisor');
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();

        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, app(InvoiceService::class));
        $invoice = $sale['invoice'];
        $subscription = $sale['subscription'];

        $this->assertSame(Subscription::PENDING_ACTIVATION, $subscription->status);

        // A bank transfer needs evidence attached.
        try {
            app(PaymentService::class)->record($manager, $client, [
                'invoice_id' => $invoice->id, 'amount_paise' => (int) $invoice->grand_total_paise, 'method' => 'upi',
            ]);
            $this->fail('A UPI payment without proof should be refused.');
        } catch (ApiException $e) {
            $this->assertSame('PROOF_REQUIRED', $e->errorCode);
        }

        $proof = Document::create([
            'owner_type' => 'client', 'owner_id' => $client->id, 'category' => 'correspondence', 'title' => 'UPI screenshot',
        ]);

        // Recording is not enough.
        $payment = app(PaymentService::class)->record($manager, $client, [
            'invoice_id' => $invoice->id,
            'amount_paise' => (int) $invoice->grand_total_paise,
            'method' => 'upi',
            'reference' => 'UTR123456',
            'proof_document_id' => $proof->id,
        ]);

        $this->assertSame(Payment::PENDING_VERIFICATION, $payment->status);
        $this->assertSame(Subscription::PENDING_ACTIVATION, $subscription->fresh()->status);
        $this->assertSame(0, (int) $invoice->fresh()->amount_paid_paise);

        // The person who recorded it cannot verify it.
        try {
            app(PaymentService::class)->verify($manager, $payment);
            $this->fail('The recorder must not verify their own payment.');
        } catch (ApiException $e) {
            $this->assertSame('SEPARATION_OF_DUTIES', $e->errorCode);
        }

        app(PaymentService::class)->verify($verifier, $payment);

        $invoice->refresh();
        $this->assertSame(Invoice::PAID, $invoice->status);
        $this->assertSame((int) $invoice->grand_total_paise, (int) $invoice->amount_paid_paise);
        $this->assertSame(0, (int) $invoice->balance_paise);

        $subscription->refresh();
        $this->assertSame(Subscription::ACTIVE, $subscription->status);
        $this->assertSame(now()->addDays(91)->toDateString(), $subscription->ends_on->toDateString());
        $this->assertFalse($advisor->can('payments.verify_manual'));
    }

    public function test_partial_payment_leaves_the_invoice_open_and_the_service_pending(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $payments = app(PaymentService::class);

        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, app(InvoiceService::class));
        $invoice = $sale['invoice'];
        $half = intdiv((int) $invoice->grand_total_paise, 2);

        $first = $payments->record($manager, $client, ['invoice_id' => $invoice->id, 'amount_paise' => $half, 'method' => 'cash']);
        $payments->verify($verifier, $first);

        $invoice->refresh();
        $this->assertSame(Invoice::PARTIALLY_PAID, $invoice->status);
        $this->assertSame($half, (int) $invoice->balance_paise);
        $this->assertSame(Subscription::PENDING_ACTIVATION, $sale['subscription']->fresh()->status);

        $second = $payments->record($manager, $client, ['invoice_id' => $invoice->id, 'amount_paise' => $half, 'method' => 'cash']);
        $payments->verify($verifier, $second);

        $this->assertSame(Invoice::PAID, $invoice->fresh()->status);
        $this->assertSame(Subscription::ACTIVE, $sale['subscription']->fresh()->status);
    }

    public function test_a_refund_pauses_the_service_and_reopens_the_invoice(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $refunder = $this->makeStaff('admin');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $payments = app(PaymentService::class);

        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, app(InvoiceService::class));
        $payment = $payments->record($manager, $client, [
            'invoice_id' => $sale['invoice']->id, 'amount_paise' => (int) $sale['invoice']->grand_total_paise, 'method' => 'cash',
        ]);
        $payments->verify($verifier, $payment);

        $this->assertSame(Subscription::ACTIVE, $sale['subscription']->fresh()->status);

        $payments->refund($refunder, $payment->fresh(), 'Client cancelled within the cooling-off window.');

        $this->assertSame(Payment::REFUNDED, $payment->fresh()->status);
        $this->assertSame(Invoice::ISSUED, $sale['invoice']->fresh()->status);
        $this->assertSame(0, (int) $sale['invoice']->fresh()->amount_paid_paise);
        $this->assertSame(Subscription::PAUSED, $sale['subscription']->fresh()->status);

        // The recorded amount itself is never edited.
        $this->expectException(LogicException::class);
        $payment->fresh()->forceFill(['amount_paise' => 1])->save();
    }

    public function test_a_service_cannot_be_sold_before_onboarding_is_complete(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $version = $this->plan();

        $client = Client::create(['client_code' => 'ESC-2026-07777', 'full_name' => 'Not onboarded', 'mobile' => '+919800002222']);
        app(OnboardingService::class)->startChecklist($client);

        try {
            app(SubscriptionService::class)->sell($manager, $client->fresh(), $version, app(InvoiceService::class));
            $this->fail('Selling should be refused while onboarding is open.');
        } catch (ApiException $e) {
            $this->assertSame('ONBOARDING_INCOMPLETE', $e->errorCode);
        }

        $this->assertDatabaseCount('subscriptions', 0);
        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_activation_without_a_settled_invoice_is_refused(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $subscriptions = app(SubscriptionService::class);

        $subscription = $subscriptions->create($manager, $client, $version);

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('A service can only start once its invoice is settled by a verified payment.');
        $subscriptions->activate($subscription, $manager);
    }

    public function test_issuing_and_verifying_produce_checkable_invoice_and_receipt_pdfs(): void
    {
        Storage::fake('local');
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $vault = app(DocumentVault::class);

        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, app(InvoiceService::class));
        $invoice = $sale['invoice']->fresh();

        $this->assertNotNull($invoice->document_id);
        $invoicePdf = $vault->contents($invoice->document->currentVersion());
        $this->assertStringStartsWith('%PDF', $invoicePdf);
        $this->assertSame($invoice->pdf_sha256, hash('sha256', $invoicePdf));

        $body = $this->getJson('/api/v1/public/verify/'.$invoice->verification_token)->assertOk()->json('data');
        $this->assertSame('invoice', $body['type']);
        $this->assertSame($invoice->invoice_number, $body['number']);
        $this->assertSame($invoice->grandTotal()->format(), $body['details']['Amount']);
        $this->assertStringNotContainsString($client->full_name, json_encode($body));

        $payment = app(PaymentService::class)->record($manager, $client, [
            'invoice_id' => $invoice->id, 'amount_paise' => (int) $invoice->grand_total_paise, 'method' => 'cash',
        ]);
        app(PaymentService::class)->verify($verifier, $payment);

        $receipt = Receipt::query()->where('payment_id', $payment->id)->sole();
        $receiptPdf = $vault->contents($receipt->document->currentVersion());

        $this->assertStringStartsWith('%PDF', $receiptPdf);
        $this->assertSame($receipt->pdf_sha256, hash('sha256', $receiptPdf));
        $this->assertStringStartsWith('RCP/', $receipt->receipt_number);

        $receiptBody = $this->getJson('/api/v1/public/verify/'.$receipt->verification_token)->assertOk()->json('data');
        $this->assertSame('receipt', $receiptBody['type']);
        $this->assertTrue($receiptBody['still_current']);

        // After a refund the receipt no longer stands, and the check says so.
        app(PaymentService::class)->refund($this->makeStaff('admin'), $payment->fresh(), 'Client cancelled.');
        $this->assertFalse($this->getJson('/api/v1/public/verify/'.$receipt->verification_token)->json('data.still_current'));
    }

    public function test_void_is_blocked_once_money_has_been_received_and_expiry_is_swept(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->plan();
        $invoices = app(InvoiceService::class);

        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, $invoices);
        $payment = app(PaymentService::class)->record($manager, $client, [
            'invoice_id' => $sale['invoice']->id, 'amount_paise' => (int) $sale['invoice']->grand_total_paise, 'method' => 'cash',
        ]);
        app(PaymentService::class)->verify($verifier, $payment);

        try {
            $invoices->void($this->makeStaff('admin'), $sale['invoice']->fresh(), 'Raised by mistake');
            $this->fail('Voiding a paid invoice should be refused.');
        } catch (ApiException $e) {
            $this->assertSame('PAYMENTS_RECEIVED', $e->errorCode);
        }

        // Past its end date, the subscription expires on the sweep.
        $sale['subscription']->fresh()->forceFill(['ends_on' => now()->subDay()->toDateString()])->save();
        $this->assertSame(1, app(SubscriptionService::class)->expireDue());
        $this->assertSame(Subscription::EXPIRED, $sale['subscription']->fresh()->status);
    }
}
