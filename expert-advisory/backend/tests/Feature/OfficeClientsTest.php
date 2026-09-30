<?php

namespace Tests\Feature;

use App\Domain\Onboarding\OnboardingService;
use App\Filament\Resources\Clients\Pages\ListClients;
use App\Filament\Resources\Clients\Pages\ViewClient;
use App\Filament\Resources\Clients\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\Clients\RelationManagers\KycChecksRelationManager;
use App\Filament\Resources\Clients\RelationManagers\RiskProfilesRelationManager;
use App\Filament\Resources\Leads\Pages\ViewLead;
use App\Models\Client;
use App\Models\Document;
use App\Models\KycCheck;
use App\Models\Lead;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use Database\Seeders\OnboardingSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class OfficeClientsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
        Storage::fake('local');
        $this->seed(OnboardingSeeder::class);

        RiskQuestionnaire::query()->where('code', 'suitability')->sole()->versions()->sole()
            ->forceFill(['status' => RiskQuestionnaireVersion::PUBLISHED, 'published_at' => now()])->save();
    }

    public function test_advisor_converts_a_lead_and_records_an_assessment(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $lead = Lead::forceCreate([
            'full_name' => 'Priya Sharma', 'mobile' => '+919800000303', 'email' => 'priya@example.test',
            'assigned_employee_id' => $advisor->employee->id,
        ]);

        $this->actingAsVerified($advisor);

        Livewire::test(ViewLead::class, ['record' => $lead->id])
            ->callAction('convertToClient', data: ['full_name' => 'Priya Sharma', 'email' => 'priya@example.test', 'mobile' => '+919800000303'])
            ->assertHasNoActionErrors();

        $client = Client::query()->where('lead_id', $lead->id)->sole();
        $this->assertSame(OnboardingService::ONBOARDING, $client->onboarding_status);

        Livewire::test(ViewClient::class, ['record' => $client->id])
            ->callAction('takeAssessment', data: ['answers' => [
                'experience' => '3_7y', 'horizon' => '3_5y', 'loss_tolerance' => 'hold',
                'income_stability' => 'stable', 'capital_share' => 'small', 'instruments' => ['equity'],
            ]])
            ->assertHasNoActionErrors();

        $profile = RiskProfile::query()->where('client_id', $client->id)->sole();
        $this->assertSame(RiskProfile::SUBMITTED, $profile->status);
        $this->assertSame('balanced', $profile->risk_category);

        // Sign-off is blocked until the client acknowledges the outcome.
        Livewire::test(RiskProfilesRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('finalize')->table($profile))
            ->assertNotified();

        $this->assertSame(RiskProfile::SUBMITTED, $profile->fresh()->status);

        Livewire::test(RiskProfilesRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('acknowledge')->table($profile))
            ->callAction(TestAction::make('finalize')->table($profile->fresh()));

        $this->assertSame(RiskProfile::FINALIZED, $profile->fresh()->status);
    }

    public function test_client_page_renders_the_checklist_risk_and_agreement_panels(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $client = Client::create([
            'client_code' => 'ESC-2026-00099', 'full_name' => 'Render Check', 'mobile' => '+919800000909',
            'relationship_manager_employee_id' => $advisor->employee->id,
        ]);
        app(OnboardingService::class)->startChecklist($client);

        $this->actingAsVerified($advisor)
            ->get('/office/clients/'.$client->id)
            ->assertOk()
            ->assertSee('Onboarding checklist')
            ->assertSee('Identity documents verified')
            ->assertSee('No assessment recorded yet', escape: false)
            ->assertSee('Nothing outstanding', escape: false);
    }

    public function test_advisor_uploads_a_document_but_cannot_verify_it(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $client = Client::create([
            'client_code' => 'ESC-2026-00042', 'full_name' => 'Imran Qureshi', 'mobile' => '+919800000404',
            'relationship_manager_employee_id' => $advisor->employee->id,
        ]);

        $this->actingAsVerified($advisor);

        Livewire::test(DocumentsRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('uploadDocument')->table(), data: [
                'category' => 'pan',
                'file' => UploadedFile::fake()->create('pan.pdf', 10, 'application/pdf'),
            ])
            ->assertHasNoActionErrors();

        $document = Document::query()->where(['owner_type' => 'client', 'owner_id' => $client->id])->sole();
        $this->assertSame(Document::PENDING, $document->status);

        Livewire::test(DocumentsRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->assertActionHidden(TestAction::make('verify')->table($document))
            ->assertActionHidden(TestAction::make('download')->table($document));

        $this->actingAsVerified($compliance);

        Livewire::test(DocumentsRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('verify')->table($document))
            ->assertHasNoActionErrors();

        $this->assertSame(Document::VERIFIED, $document->fresh()->status);
    }

    public function test_kyc_can_be_recorded_by_an_advisor_and_verified_by_compliance(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $client = Client::create([
            'client_code' => 'ESC-2026-00043', 'full_name' => 'Neha Rao', 'mobile' => '+919800000505',
            'relationship_manager_employee_id' => $advisor->employee->id,
        ]);

        $this->actingAsVerified($advisor);

        Livewire::test(KycChecksRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('recordCheck')->table(), data: ['type' => 'pan', 'identifier' => 'ABCDE1234F'])
            ->assertHasNoActionErrors();

        $check = KycCheck::query()->where('client_id', $client->id)->sole();
        $this->assertSame('XXXXXX234F', $check->identifier_masked);

        Livewire::test(KycChecksRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->assertActionHidden(TestAction::make('verify')->table($check));

        $this->actingAsVerified($compliance);

        Livewire::test(KycChecksRelationManager::class, ['ownerRecord' => $client, 'pageClass' => ViewClient::class])
            ->callAction(TestAction::make('verify')->table($check));

        $this->assertSame(KycCheck::VERIFIED, $check->fresh()->status);
    }

    public function test_client_list_is_scoped_and_activation_is_blocked_while_steps_are_open(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');

        $mine = Client::create(['client_code' => 'ESC-2026-00044', 'full_name' => 'Mine', 'relationship_manager_employee_id' => $advisor->employee->id]);
        $theirs = Client::create(['client_code' => 'ESC-2026-00045', 'full_name' => 'Theirs', 'relationship_manager_employee_id' => $other->employee->id]);

        app(OnboardingService::class)->startChecklist($mine);

        $this->actingAsVerified($advisor);

        Livewire::test(ListClients::class, ['activeTab' => 'all'])
            ->assertCanSeeTableRecords([$mine])
            ->assertCanNotSeeTableRecords([$theirs]);

        Livewire::test(ViewClient::class, ['record' => $mine->id])
            ->callAction('activate')
            ->assertNotified();

        $this->assertSame(OnboardingService::ONBOARDING, $mine->fresh()->onboarding_status);
    }
}
