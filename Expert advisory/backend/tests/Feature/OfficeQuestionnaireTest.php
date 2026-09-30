<?php

namespace Tests\Feature;

use App\Filament\Resources\Agreements\Pages\ManageAgreements;
use App\Filament\Resources\Agreements\RelationManagers\VersionsRelationManager;
use App\Filament\Resources\RiskQuestionnaires\Pages\ManageRiskQuestionnaires;
use App\Models\Agreement;
use App\Models\AgreementVersion;
use App\Models\RiskQuestion;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use Database\Seeders\OnboardingSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Tests\TestCase;

class OfficeQuestionnaireTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
        $this->seed(OnboardingSeeder::class);
    }

    public function test_a_new_questionnaire_version_is_drafted_and_published_only_when_bands_cover_every_score(): void
    {
        $compliance = $this->makeStaff('compliance_admin');
        $questionnaire = RiskQuestionnaire::query()->where('code', 'suitability')->sole();

        $this->actingAsVerified($compliance);

        $version = [
            'methodology_version' => 'suitability-2.0',
            'valid_for_days' => 365,
            'questions' => [[
                'code' => 'horizon',
                'text' => 'How long can you stay invested?',
                'type' => RiskQuestion::SINGLE,
                'weight' => 2,
                'options' => [
                    ['label' => 'Under a year', 'value' => 'short', 'score' => 0],
                    ['label' => 'Over five years', 'value' => 'long', 'score' => 5],
                ],
            ]],
            // Deliberately leaves scores 6-10 uncovered.
            'bands' => [
                ['key' => 'low', 'label' => 'Low', 'min_score' => 0, 'max_score' => 3, 'description' => null],
                ['key' => 'mid', 'label' => 'Medium', 'min_score' => 4, 'max_score' => 5, 'description' => null],
            ],
        ];

        Livewire::test(ManageRiskQuestionnaires::class)
            ->callAction(TestAction::make('draftVersion')->table($questionnaire), data: $version)
            ->assertHasNoActionErrors();

        $draft = $questionnaire->versions()->where('version', 2)->sole();
        $this->assertSame(RiskQuestionnaireVersion::DRAFT, $draft->status);
        $this->assertSame(2, $draft->version);
        $this->assertSame(10, $draft->maxScore());

        Livewire::test(ManageRiskQuestionnaires::class)
            ->callAction(TestAction::make('publish')->table($questionnaire))
            ->assertNotified();

        $this->assertSame(RiskQuestionnaireVersion::DRAFT, $draft->fresh()->status);

        // Widen the top band and it publishes, retiring the previous published version.
        $questionnaire->versions()->where('version', 1)->sole()
            ->forceFill(['status' => RiskQuestionnaireVersion::PUBLISHED, 'published_at' => now()])->save();

        $draft->forceFill(['bands' => [
            ['key' => 'low', 'label' => 'Low', 'min_score' => 0, 'max_score' => 3],
            ['key' => 'mid', 'label' => 'Medium', 'min_score' => 4, 'max_score' => 10],
        ]])->save();

        Livewire::test(ManageRiskQuestionnaires::class)
            ->callAction(TestAction::make('publish')->table($questionnaire))
            ->assertHasNoActionErrors();

        $this->assertSame(RiskQuestionnaireVersion::PUBLISHED, $draft->fresh()->status);
        $this->assertSame(RiskQuestionnaireVersion::RETIRED, $questionnaire->versions()->where('version', 1)->sole()->status);
    }

    public function test_agreement_versions_move_through_draft_approval_and_publication(): void
    {
        $compliance = $this->makeStaff('compliance_admin');
        $admin = $this->makeStaff('super_admin');
        $agreement = Agreement::query()->where('code', 'client_agreement')->sole();

        $this->actingAsVerified($compliance);

        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $agreement, 'pageClass' => ManageAgreements::class])
            ->callAction(TestAction::make('draft')->table(), data: ['body_markdown' => '## Scope'.PHP_EOL.'Research services only.'])
            ->assertHasNoActionErrors();

        $version = $agreement->versions()->sole();
        $this->assertNotEmpty($version->body_sha256);

        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $agreement, 'pageClass' => ManageAgreements::class])
            ->callAction(TestAction::make('submit')->table($version));

        $this->assertSame(AgreementVersion::IN_REVIEW, $version->fresh()->status);

        // The author may see the action but the service refuses: approval needs a second person.
        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $agreement, 'pageClass' => ManageAgreements::class])
            ->callAction(TestAction::make('approve')->table($version->fresh()))
            ->assertNotified();

        $this->assertNull($version->fresh()->approved_at);

        $this->actingAsVerified($admin);

        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $agreement, 'pageClass' => ManageAgreements::class])
            ->callAction(TestAction::make('approve')->table($version->fresh()))
            ->callAction(TestAction::make('publish')->table($version->fresh()))
            ->assertHasNoActionErrors();

        $version->refresh();
        $this->assertSame(AgreementVersion::PUBLISHED, $version->status);
        $this->assertSame($admin->id, $version->approved_by);
    }
}
