<?php

namespace Tests\Feature;

use App\Domain\Billing\InvoiceService;
use App\Domain\Billing\Money;
use App\Domain\Billing\SubscriptionService;
use App\Domain\Onboarding\OnboardingService;
use App\Filament\Resources\Clients\Pages\ViewClient;
use App\Filament\Resources\Invoices\Pages\ListInvoices;
use App\Filament\Resources\Invoices\Pages\ViewInvoice;
use App\Filament\Resources\Payments\Pages\ListPayments;
use App\Filament\Resources\Services\Pages\ManageServices;
use App\Filament\Resources\Services\RelationManagers\PlansRelationManager;
use App\Filament\Resources\Subscriptions\Pages\ListSubscriptions;
use App\Models\Agreement;
use App\Models\AgreementAcceptance;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\Subscription;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class OfficeBillingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
        Storage::fake('local');
    }

    private function onboardedClient(): Client
    {
        $client = Client::create([
            'client_code' => 'ESC-2026-0'.random_int(1000, 9999),
            'full_name' => 'Meera Iyer',
            'email' => 'meera@example.test',
            'mobile' => '+919800003333',
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

    private function publishedPlan(): PlanVersion
    {
        $service = Service::create(['code' => 'equity', 'name' => 'Equity research', 'category' => 'research']);
        $plan = Plan::create(['service_id' => $service->id, 'code' => 'equity-q', 'name' => 'Quarterly', 'billing_cycle' => 'quarterly', 'duration_days' => 91]);
        $version = new PlanVersion(['plan_id' => $plan->id, 'version' => 1, 'base_price_paise' => 1_180_000, 'tax_code' => 'gst_18']);
        $version->save();
        $version->forceFill(['status' => PlanVersion::PUBLISHED, 'published_at' => now()])->save();

        return $version->fresh();
    }

    public function test_a_price_is_published_from_the_plans_screen_and_then_frozen(): void
    {
        $admin = $this->makeStaff('admin');
        $service = Service::create(['code' => 'equity', 'name' => 'Equity research', 'category' => 'research']);
        $plan = Plan::create(['service_id' => $service->id, 'code' => 'equity-q', 'name' => 'Quarterly', 'billing_cycle' => 'quarterly', 'duration_days' => 91]);

        $this->actingAsVerified($admin);

        Livewire::test(PlansRelationManager::class, ['ownerRecord' => $service, 'pageClass' => ManageServices::class])
            ->callAction(TestAction::make('publishPrice')->table($plan), data: ['price_rupees' => '11800', 'tax_code' => 'gst_18'])
            ->assertHasNoActionErrors();

        $version = $plan->fresh()->publishedVersion();
        $this->assertSame(1_180_000, (int) $version->base_price_paise);
        $this->assertSame('₹11,800.00', $version->price()->format());

        // Publishing again retires the old price rather than editing it.
        Livewire::test(PlansRelationManager::class, ['ownerRecord' => $service, 'pageClass' => ManageServices::class])
            ->callAction(TestAction::make('publishPrice')->table($plan), data: ['price_rupees' => '14000', 'tax_code' => 'gst_18']);

        $this->assertSame(PlanVersion::RETIRED, $version->fresh()->status);
        $this->assertSame(1_400_000, (int) $plan->fresh()->publishedVersion()->base_price_paise);
    }

    public function test_selling_raises_an_invoice_and_the_service_waits_for_verified_money(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->publishedPlan();

        // payment_manager can bill; make sure they can also reach the client record.
        $this->actingAsVerified($manager);

        Livewire::test(ViewClient::class, ['record' => $client->id])
            ->callAction('sellService', data: ['plan_version_id' => $version->id])
            ->assertHasNoActionErrors();

        $invoice = Invoice::query()->where('client_id', $client->id)->sole();
        $subscription = Subscription::query()->where('client_id', $client->id)->sole();

        $this->assertSame(Invoice::ISSUED, $invoice->status);
        $this->assertSame(1_392_400, (int) $invoice->grand_total_paise);
        $this->assertSame(Subscription::PENDING_ACTIVATION, $subscription->status);

        // Record the payment from the invoice page.
        Livewire::test(ViewInvoice::class, ['record' => $invoice->id])
            ->callAction('recordPayment', data: [
                'method' => 'cash',
                'amount_rupees' => $invoice->grandTotal()->toDecimal(),
                'received_at' => now()->toDateTimeString(),
            ])
            ->assertHasNoActionErrors();

        $payment = Payment::query()->where('invoice_id', $invoice->id)->sole();
        $this->assertSame(Payment::PENDING_VERIFICATION, $payment->status);

        // The person who recorded it is refused; a second person can verify.
        Livewire::test(ListPayments::class)
            ->callAction(TestAction::make('verify')->table($payment), data: [])
            ->assertNotified();

        $this->assertSame(Payment::PENDING_VERIFICATION, $payment->fresh()->status);

        $this->actingAsVerified($verifier);

        Livewire::test(ListPayments::class)
            ->callAction(TestAction::make('verify')->table($payment), data: ['note' => 'Seen in the bank statement'])
            ->assertHasNoActionErrors();

        $this->assertSame(Payment::SUCCEEDED, $payment->fresh()->status);
        $this->assertSame(Invoice::PAID, $invoice->fresh()->status);
        $this->assertSame(Subscription::ACTIVE, $subscription->fresh()->status);
    }

    public function test_billing_screens_are_closed_to_staff_without_billing_permissions(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');
        $client = $this->onboardedClient();
        $version = $this->publishedPlan();

        // The client belongs to someone else, so their billing stays out of this advisor's sight.
        $client->forceFill(['relationship_manager_employee_id' => $other->employee->id])->save();
        app(SubscriptionService::class)->sell($this->makeStaff('payment_manager'), $client->fresh(), $version, app(InvoiceService::class));

        $own = Client::create([
            'client_code' => 'ESC-2026-08888', 'full_name' => 'Own client', 'mobile' => '+919800004444',
            'relationship_manager_employee_id' => $advisor->employee->id,
        ]);

        $this->actingAsVerified($advisor);

        // An advisor may look, but only at their own clients' billing, and cannot raise or verify anything.
        $sale = Invoice::query()->sole();
        Livewire::test(ListInvoices::class, ['activeTab' => 'all'])->assertCanNotSeeTableRecords([$sale]);
        Livewire::test(ListSubscriptions::class, ['activeTab' => 'all'])->assertCountTableRecords(0);

        $this->assertFalse($advisor->can('invoices.create'));
        $this->assertFalse($advisor->can('payments.verify_manual'));
        $this->assertFalse($advisor->can('services.manage'));

        Livewire::test(ViewClient::class, ['record' => $own->id])
            ->assertActionHidden('sellService');
    }

    public function test_manager_sees_invoices_payments_and_subscriptions(): void
    {
        $manager = $this->makeStaff('payment_manager');
        $client = $this->onboardedClient();
        $version = $this->publishedPlan();
        $sale = app(SubscriptionService::class)->sell($manager, $client, $version, app(InvoiceService::class));

        $this->actingAsVerified($manager);

        Livewire::test(ListInvoices::class, ['activeTab' => 'open'])->assertCanSeeTableRecords([$sale['invoice']]);
        Livewire::test(ListSubscriptions::class, ['activeTab' => 'awaiting_payment'])->assertCanSeeTableRecords([$sale['subscription']]);

        $this->get('/office/invoices/'.$sale['invoice']->id)
            ->assertOk()
            ->assertSee($sale['invoice']->invoice_number)
            ->assertSee('A service starts only when a verified payment settles this invoice.', escape: false);

        $this->assertSame(
            Money::paise((int) $sale['invoice']->grand_total_paise)->format(),
            $sale['invoice']->grandTotal()->format(),
        );
    }
}
