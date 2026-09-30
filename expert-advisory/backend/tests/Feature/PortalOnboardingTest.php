<?php

namespace Tests\Feature;

use App\Domain\Billing\InvoiceService;
use App\Domain\Billing\PaymentService;
use App\Domain\Billing\SubscriptionService;
use App\Domain\Onboarding\AgreementService;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Onboarding\RiskProfileService;
use App\Models\Agreement;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\OnboardingSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PortalOnboardingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(OnboardingSeeder::class);

        RiskQuestionnaire::query()->where('code', 'suitability')->sole()->versions()->sole()
            ->forceFill(['status' => RiskQuestionnaireVersion::PUBLISHED, 'published_at' => now()])->save();
    }

    private function clientFor(User $user, array $attributes = []): Client
    {
        $client = Client::create(array_merge([
            'user_id' => $user->id,
            'client_code' => 'ESC-2026-0'.random_int(1000, 9999),
            'full_name' => $user->name,
            'email' => $user->email,
        ], $attributes));

        app(OnboardingService::class)->startChecklist($client);

        return $client->refresh();
    }

    private function publishedAgreement(): AgreementVersion
    {
        $agreement = Agreement::query()->where('code', 'client_agreement')->sole();
        $version = new AgreementVersion([
            'agreement_id' => $agreement->id, 'version' => 1, 'body_markdown' => '## Scope'.PHP_EOL.'Research services.',
        ]);
        $version->save();
        $version->forceFill(['status' => AgreementVersion::PUBLISHED, 'approved_at' => now(), 'published_at' => now(), 'effective_from' => now()->toDateString()])->save();

        return $version;
    }

    public function test_client_sees_their_own_checklist_and_nothing_else(): void
    {
        $user = $this->makeClient();
        $client = $this->clientFor($user);
        $this->publishedAgreement();

        $response = $this->actingAsVerified($user)->getJson('/api/v1/client/onboarding')->assertOk();

        $response->assertJsonPath('data.client.client_code', $client->client_code);
        $response->assertJsonPath('data.client.onboarding_status', OnboardingService::ONBOARDING);
        $response->assertJsonCount(count(config('onboarding.steps')), 'data.steps');
        $response->assertJsonCount(1, 'data.outstanding_agreements');
        $this->assertNull($response->json('data.risk_profile'));

        // Staff without portal access cannot use the client endpoints.
        $this->actingAsVerified($this->makeStaff('business_advisor'))
            ->getJson('/api/v1/client/onboarding')
            ->assertForbidden();
    }

    public function test_client_takes_the_questionnaire_and_acknowledges_the_outcome(): void
    {
        $user = $this->makeClient();
        $client = $this->clientFor($user);

        $this->actingAsVerified($user);

        $this->getJson('/api/v1/client/risk-questionnaire')
            ->assertOk()
            ->assertJsonPath('data.methodology_version', 'suitability-1.0')
            ->assertJsonCount(6, 'data.questions');

        $this->assertApiError($this->postJson('/api/v1/client/risk-profile', ['answers' => ['experience' => '3_7y']]), 422, 'INCOMPLETE_ASSESSMENT');

        $created = $this->postJson('/api/v1/client/risk-profile', ['answers' => [
            'experience' => '3_7y', 'horizon' => '3_5y', 'loss_tolerance' => 'hold',
            'income_stability' => 'stable', 'capital_share' => 'small', 'instruments' => ['equity', 'mf'],
        ]])->assertCreated();

        $created->assertJsonPath('data.category', 'balanced')->assertJsonPath('data.score', 34);
        $uuid = $created->json('data.uuid');

        $this->postJson("/api/v1/client/risk-profile/{$uuid}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.status', RiskProfile::SUBMITTED);

        $this->assertNotNull(RiskProfile::query()->where('uuid', $uuid)->sole()->acknowledged_at);

        // Another client cannot acknowledge someone else's assessment.
        $intruder = $this->makeClient(['email' => 'intruder@example.test']);
        $this->clientFor($intruder);
        $this->actingAsVerified($intruder)->postJson("/api/v1/client/risk-profile/{$uuid}/acknowledge")->assertNotFound();

        $this->assertSame($client->id, RiskProfile::query()->where('uuid', $uuid)->sole()->client_id);
    }

    public function test_client_accepts_an_agreement_and_uploads_a_document(): void
    {
        $user = $this->makeClient();
        $client = $this->clientFor($user);
        $version = $this->publishedAgreement();

        $this->actingAsVerified($user);

        $this->postJson("/api/v1/client/agreements/{$version->id}/accept", ['accept' => true])
            ->assertCreated()
            ->assertJsonPath('data.version', 1);

        $this->postJson("/api/v1/client/agreements/{$version->id}/accept", ['accept' => false])->assertStatus(422);

        $this->assertDatabaseCount('agreement_acceptances', 1);

        $created = $this->postJson('/api/v1/client/documents', [
            'category' => 'pan',
            'file' => UploadedFile::fake()->create('pan.pdf', 20, 'application/pdf'),
        ])->assertCreated();

        $uuid = $created->json('data.uuid');
        $document = Document::query()->where('uuid', $uuid)->sole();
        $this->assertSame(Document::PENDING, $document->status);
        $this->assertSame($client->id, $document->owner_id);

        $link = $this->getJson("/api/v1/client/documents/{$uuid}/link")->assertOk()->json('data.url');
        $this->get($link)->assertOk()->assertDownload('pan.pdf');

        // The checklist now shows the agreement step complete.
        $this->getJson('/api/v1/client/onboarding')
            ->assertOk()
            ->assertJsonPath('data.outstanding_agreements', [])
            ->assertJsonFragment(['key' => 'agreements', 'label' => 'Service agreement accepted', 'status' => 'completed', 'is_required' => true, 'completed_at' => $client->onboardingSteps()->where('key', 'agreements')->sole()->fresh()->completed_at?->toIso8601String()]);
    }

    public function test_client_sees_their_own_services_invoices_and_receipts(): void
    {
        $user = $this->makeClient();
        $client = $this->clientFor($user);
        $manager = $this->makeStaff('payment_manager');
        $verifier = $this->makeStaff('payment_manager');

        // Complete onboarding so a service can be sold.
        $version = $this->publishedAgreement();
        app(AgreementService::class)->accept($client, $version, 'portal', acceptedBy: $user);
        foreach ((array) config('onboarding.kyc.required_types') as $type) {
            KycCheck::create(['client_id' => $client->id, 'type' => $type])
                ->forceFill(['status' => KycCheck::VERIFIED, 'verified_at' => now()])->save();
        }
        $risk = app(RiskProfileService::class);
        $profile = $risk->submit($client, RiskQuestionnaire::query()->where('code', 'suitability')->sole()->versions()->sole(), [
            'experience' => '3_7y', 'horizon' => '3_5y', 'loss_tolerance' => 'hold',
            'income_stability' => 'stable', 'capital_share' => 'small', 'instruments' => ['equity'],
        ], $user);
        $risk->acknowledge($profile);
        $risk->finalize($manager, $profile);
        OnboardingStep::query()->where('client_id', $client->id)
            ->whereNotIn('key', ['profile', 'agreements', 'kyc', 'risk_profile'])
            ->update(['status' => OnboardingStep::COMPLETED, 'completed_at' => now()]);

        $service = Service::create(['code' => 'equity', 'name' => 'Equity research', 'category' => 'research']);
        $plan = Plan::create(['service_id' => $service->id, 'code' => 'equity-q', 'name' => 'Quarterly', 'billing_cycle' => 'quarterly', 'duration_days' => 91]);
        $planVersion = new PlanVersion(['plan_id' => $plan->id, 'version' => 1, 'base_price_paise' => 1_180_000, 'tax_code' => 'gst_18']);
        $planVersion->save();
        $planVersion->forceFill(['status' => PlanVersion::PUBLISHED, 'published_at' => now()])->save();

        $sale = app(SubscriptionService::class)->sell($manager, $client->fresh(), $planVersion->fresh(), app(InvoiceService::class));
        $payment = app(PaymentService::class)->record($manager, $client, [
            'invoice_id' => $sale['invoice']->id, 'amount_paise' => (int) $sale['invoice']->grand_total_paise, 'method' => 'cash',
        ]);
        app(PaymentService::class)->verify($verifier, $payment);

        $this->actingAsVerified($user);
        $body = $this->getJson('/api/v1/client/billing')->assertOk()->json('data');

        $this->assertSame('₹13,924.00', $body['invoices'][0]['total']);
        $this->assertSame('paid', $body['invoices'][0]['status']);
        $this->assertSame('active', $body['subscriptions'][0]['status']);
        $this->assertTrue($body['payments'][0]['has_receipt']);

        $invoiceLink = $this->getJson('/api/v1/client/invoices/'.$sale['invoice']->uuid.'/pdf')->assertOk()->json('data.url');
        $this->get($invoiceLink)->assertOk();

        $receiptLink = $this->getJson('/api/v1/client/payments/'.$payment->uuid.'/receipt')->assertOk()->json('data.url');
        $this->get($receiptLink)->assertOk();

        // Another client sees none of it.
        $intruder = $this->makeClient(['email' => 'nosy@example.test']);
        $this->clientFor($intruder);
        $this->actingAsVerified($intruder);

        $this->getJson('/api/v1/client/billing')->assertOk()->assertJsonPath('data.invoices', [])->assertJsonPath('data.subscriptions', []);
        $this->getJson('/api/v1/client/invoices/'.$sale['invoice']->uuid.'/pdf')->assertNotFound();
    }

    public function test_a_client_cannot_reach_another_clients_document(): void
    {
        $owner = $this->makeClient();
        $ownerClient = $this->clientFor($owner);
        $intruder = $this->makeClient(['email' => 'other@example.test']);
        $this->clientFor($intruder);

        $this->actingAsVerified($owner);
        $uuid = $this->postJson('/api/v1/client/documents', [
            'category' => 'address_proof',
            'file' => UploadedFile::fake()->create('bill.pdf', 10, 'application/pdf'),
        ])->assertCreated()->json('data.uuid');

        $link = $this->getJson("/api/v1/client/documents/{$uuid}/link")->assertOk()->json('data.url');

        $this->actingAsVerified($intruder);
        $this->getJson("/api/v1/client/documents/{$uuid}/link")->assertNotFound();
        $this->withHeaders(['Accept' => 'text/html'])->get($link)->assertForbidden();

        $this->assertSame($ownerClient->id, Document::query()->where('uuid', $uuid)->sole()->owner_id);
    }
}
