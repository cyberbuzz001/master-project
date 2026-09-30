<?php

namespace Tests\Feature;

use App\Domain\Billing\AllocationService;
use App\Domain\Billing\InvoiceService;
use App\Domain\Billing\PaymentService;
use App\Domain\Billing\SubscriptionService;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Shared\ApiException;
use App\Models\Agreement;
use App\Models\AgreementAcceptance;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class GatewayWebhookTest extends TestCase
{
    private const SECRET = 'test-webhook-secret';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        config([
            'billing.payments.providers.razorpay.enabled' => true,
            'services.razorpay.key_id' => 'rzp_test_key',
            'services.razorpay.key_secret' => 'rzp_test_secret',
            'services.razorpay.webhook_secret' => self::SECRET,
        ]);
    }

    private function onboardedClient(): Client
    {
        $client = Client::create([
            'client_code' => 'ESC-2026-0'.random_int(1000, 9999),
            'full_name' => 'Arjun Das',
            'email' => 'arjun@example.test',
            'mobile' => '+919800005555',
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

        app(OnboardingService::class)->startChecklist($client);
        OnboardingStep::query()
            ->where('client_id', $client->id)
            ->whereNotIn('key', ['profile', 'agreements', 'kyc', 'risk_profile'])
            ->update(['status' => OnboardingStep::COMPLETED, 'completed_at' => now()]);

        return $client->fresh();
    }

    /**
     * @return array{invoice: Invoice, subscription: Subscription}
     */
    private function sale(): array
    {
        $manager = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();

        $service = Service::create(['code' => 'equity', 'name' => 'Equity research', 'category' => 'research']);
        $plan = Plan::create(['service_id' => $service->id, 'code' => 'equity-q', 'name' => 'Quarterly', 'billing_cycle' => 'quarterly', 'duration_days' => 91]);
        $planVersion = new PlanVersion(['plan_id' => $plan->id, 'version' => 1, 'base_price_paise' => 1_180_000, 'tax_code' => 'gst_18']);
        $planVersion->save();
        $planVersion->forceFill(['status' => PlanVersion::PUBLISHED, 'published_at' => now()])->save();

        return app(SubscriptionService::class)->sell($manager, $client, $planVersion->fresh(), app(InvoiceService::class));
    }

    private function callbackPayload(Invoice $invoice, string $eventId = 'evt_1', string $event = 'payment.captured'): array
    {
        return [
            'id' => $eventId,
            'event' => $event,
            'payload' => ['payment' => ['entity' => [
                'id' => 'pay_123',
                'amount' => (int) $invoice->grand_total_paise,
                'notes' => ['invoice_number' => $invoice->invoice_number],
            ]]],
        ];
    }

    private function sendCallback(array $payload, ?string $secret = self::SECRET): TestResponse
    {
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $headers = ['Content-Type' => 'application/json'];

        if ($secret !== null) {
            $headers['X-Razorpay-Signature'] = hash_hmac('sha256', $body, $secret);
        }

        return $this->call('POST', '/api/v1/webhooks/payments/razorpay', [], [], [], $this->transformHeadersToServerVars($headers), $body);
    }

    public function test_a_signed_callback_settles_the_invoice_and_starts_the_service(): void
    {
        $sale = $this->sale();
        $invoice = $sale['invoice'];

        $this->sendCallback($this->callbackPayload($invoice))->assertOk()->assertJsonPath('data.status', 'processed');

        $payment = Payment::query()->where('invoice_id', $invoice->id)->sole();
        $this->assertSame(Payment::SUCCEEDED, $payment->status);
        $this->assertSame('razorpay', $payment->provider);
        $this->assertSame('pay_123', $payment->provider_reference);
        $this->assertNull($payment->verified_by, 'A gateway payment is verified by the provider, not a person.');

        $this->assertSame(Invoice::PAID, $invoice->fresh()->status);
        $this->assertSame(Subscription::ACTIVE, $sale['subscription']->fresh()->status);
        $this->assertSame(WebhookEvent::PROCESSED, WebhookEvent::query()->sole()->status);
    }

    public function test_a_replayed_callback_changes_nothing(): void
    {
        $sale = $this->sale();
        $payload = $this->callbackPayload($sale['invoice']);

        $this->sendCallback($payload)->assertOk()->assertJsonPath('data.duplicate', false);
        $this->sendCallback($payload)->assertOk()->assertJsonPath('data.duplicate', true);
        $this->sendCallback($payload)->assertOk()->assertJsonPath('data.duplicate', true);

        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, WebhookEvent::query()->count());
        $this->assertSame((int) $sale['invoice']->grand_total_paise, (int) $sale['invoice']->fresh()->amount_paid_paise);
    }

    public function test_an_unsigned_or_wrongly_signed_callback_never_moves_money(): void
    {
        $sale = $this->sale();

        $this->sendCallback($this->callbackPayload($sale['invoice']), secret: 'wrong-secret')
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'invalid_signature');

        $this->sendCallback($this->callbackPayload($sale['invoice'], eventId: 'evt_2'), secret: null)
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'invalid_signature');

        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(Invoice::ISSUED, $sale['invoice']->fresh()->status);
        $this->assertSame(Subscription::PENDING_ACTIVATION, $sale['subscription']->fresh()->status);
        // The attempts are kept for inspection.
        $this->assertSame(2, WebhookEvent::query()->where('status', WebhookEvent::FAILED)->count());
    }

    public function test_a_failed_payment_event_records_the_failure_without_starting_anything(): void
    {
        $sale = $this->sale();

        $this->sendCallback($this->callbackPayload($sale['invoice'], event: 'payment.failed'))->assertOk();

        $this->assertSame(Payment::FAILED, Payment::query()->sole()->status);
        $this->assertSame(Invoice::ISSUED, $sale['invoice']->fresh()->status);
        $this->assertSame(Subscription::PENDING_ACTIVATION, $sale['subscription']->fresh()->status);
    }

    public function test_a_callback_for_an_unknown_invoice_is_kept_but_not_applied(): void
    {
        $this->sale();

        $payload = [
            'id' => 'evt_unknown',
            'event' => 'payment.captured',
            'payload' => ['payment' => ['entity' => ['id' => 'pay_x', 'amount' => 100, 'notes' => ['invoice_number' => 'INV/2026-27/99999']]]],
        ];

        $this->sendCallback($payload)->assertOk()->assertJsonPath('data.status', 'unmatched');

        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(WebhookEvent::FAILED, WebhookEvent::query()->sole()->status);
    }

    public function test_a_disabled_provider_accepts_nothing(): void
    {
        config(['billing.payments.providers.razorpay.enabled' => false]);
        $sale = $this->sale();

        $this->sendCallback($this->callbackPayload($sale['invoice']))->assertStatus(503);

        $this->assertSame(0, WebhookEvent::query()->count());
        $this->assertSame(0, Payment::query()->count());
    }

    public function test_payment_credit_needs_a_second_approver_and_cannot_exceed_the_payment(): void
    {
        $sale = $this->sale();
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $teamLeader = $this->makeStaff('team_leader');
        $advisor = $this->makeStaff('business_advisor');

        $payment = app(PaymentService::class)->record($manager, $sale['invoice']->client, [
            'invoice_id' => $sale['invoice']->id, 'amount_paise' => (int) $sale['invoice']->grand_total_paise, 'method' => 'cash',
        ]);
        app(PaymentService::class)->verify($verifier, $payment);

        $allocation = PaymentAllocation::create([
            'payment_id' => $payment->id,
            'employee_id' => $advisor->employee->id,
            'amount_paise' => (int) $payment->amount_paise,
            'submitted_by' => $verifier->id,
        ]);

        $allocations = app(AllocationService::class);

        // A team leader may submit credit but not decide on it.
        $this->assertTrue($teamLeader->can('allocations.submit'));
        $this->assertFalse($teamLeader->can('allocations.approve'));

        try {
            $allocations->approve($teamLeader, $allocation);
            $this->fail('Approving without the permission should be refused.');
        } catch (ApiException $e) {
            $this->assertSame(403, $e->status);
        }

        // Nor may the person who submitted it, even though they hold the permission.
        try {
            $allocations->approve($verifier, $allocation);
            $this->fail('The submitter must not approve their own allocation.');
        } catch (ApiException $e) {
            $this->assertSame('SEPARATION_OF_DUTIES', $e->errorCode);
        }

        $allocations->approve($manager, $allocation);
        $this->assertSame(PaymentAllocation::APPROVED, $allocation->fresh()->status);
        $this->assertSame((int) $payment->amount_paise, $allocations->approvedTotalFor($advisor->employee->id)->paise);

        // A second credit on the same payment would exceed it.
        $second = PaymentAllocation::create([
            'payment_id' => $payment->id,
            'employee_id' => $teamLeader->employee->id,
            'amount_paise' => 100,
            'submitted_by' => $advisor->id,
        ]);

        try {
            $allocations->approve($manager, $second);
            $this->fail('Credit beyond the payment should be refused.');
        } catch (ApiException $e) {
            $this->assertSame('ALLOCATION_TOO_LARGE', $e->errorCode);
        }

        // A refund stops the approved credit counting.
        app(PaymentService::class)->refund($this->makeStaff('admin'), $payment->fresh(), 'Client cancelled.');
        $this->assertSame(0, $allocations->approvedTotalFor($advisor->employee->id)->paise);
    }
}
