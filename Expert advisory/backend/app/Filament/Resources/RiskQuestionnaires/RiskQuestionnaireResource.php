<?php

namespace App\Filament\Resources\RiskQuestionnaires;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Filament\Resources\RiskQuestionnaires\Pages\ManageRiskQuestionnaires;
use App\Filament\Support\DomainAction;
use App\Models\RiskQuestion;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use UnitEnum;

/**
 * Questionnaire authoring. A published version is frozen — scores recorded under it must stay
 * reproducible — so changes are made by drafting a new version.
 */
class RiskQuestionnaireResource extends Resource
{
    protected static ?string $model = RiskQuestionnaire::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClipboardDocumentList;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 4;

    protected static ?string $navigationLabel = 'Risk questionnaires';

    protected static ?string $slug = 'risk-questionnaires';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['compliance.review', 'risk_profile.view', 'policies.edit']);
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('compliance.rules.manage');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('compliance.rules.manage');
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('code')->required()->maxLength(64)->helperText('Referenced by the assessment screen; "suitability" is the one used during onboarding.'),
            TextInput::make('title')->required()->maxLength(255),
            Textarea::make('description')->rows(2)->maxLength(1000)->columnSpanFull(),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->searchable()->description(fn (RiskQuestionnaire $record) => $record->code),
                TextColumn::make('versions_count')->label('Versions')->counts('versions'),
                TextColumn::make('published')->label('Published version')
                    ->state(fn (RiskQuestionnaire $record) => $record->publishedVersion()?->version ?? '—')
                    ->badge()
                    ->color(fn (string $state) => $state === '—' ? 'warning' : 'success'),
                TextColumn::make('is_active')->label('Active')->badge()
                    ->formatStateUsing(fn (bool $state) => $state ? 'Yes' : 'No')
                    ->color(fn (bool $state) => $state ? 'success' : 'gray'),
            ])
            ->recordActions([
                Action::make('versions')
                    ->label('Versions')
                    ->icon(Heroicon::OutlinedRectangleStack)
                    ->color('gray')
                    ->modalWidth('4xl')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (RiskQuestionnaire $record) => view('filament.compliance.questionnaire-versions', ['questionnaire' => $record])),
                ActionGroup::make([
                    Action::make('draftVersion')
                        ->label('Draft a new version')
                        ->icon(Heroicon::OutlinedPencilSquare)
                        ->visible(fn () => auth()->user()->can('compliance.rules.manage'))
                        ->modalWidth('5xl')
                        ->schema(self::versionSchema())
                        ->fillForm(fn (RiskQuestionnaire $record) => self::prefill($record))
                        ->action(fn (array $data, RiskQuestionnaire $record, Action $action) => DomainAction::run(
                            $action,
                            fn () => self::createVersion($record, $data),
                            'Draft version created',
                        )),
                    Action::make('publish')
                        ->label('Publish latest draft')
                        ->icon(Heroicon::OutlinedGlobeAlt)
                        ->color('success')
                        ->requiresConfirmation()
                        ->modalDescription('Once published, the questions, scores and bands are frozen. Assessments already taken are unaffected.')
                        ->visible(fn (RiskQuestionnaire $record) => auth()->user()->can('compliance.rules.manage')
                            && $record->versions()->where('status', RiskQuestionnaireVersion::DRAFT)->exists())
                        ->action(fn (RiskQuestionnaire $record, Action $action) => DomainAction::run($action, fn () => self::publishLatestDraft($record), 'Questionnaire published')),
                ]),
            ]);
    }

    /**
     * @return list<Component>
     */
    public static function versionSchema(): array
    {
        return [
            Section::make('Methodology')->columns(2)->schema([
                TextInput::make('methodology_version')->required()->maxLength(32)->helperText('Recorded on every assessment taken under this version.'),
                TextInput::make('valid_for_days')->label('Valid for (days)')->integer()->minValue(30)->maxValue(1825)->default(365),
            ]),
            Section::make('Questions')->schema([
                Repeater::make('questions')
                    ->schema([
                        TextInput::make('code')->required()->maxLength(64),
                        TextInput::make('text')->label('Question')->required()->maxLength(1000)->columnSpanFull(),
                        Select::make('type')->options([
                            RiskQuestion::SINGLE => 'Choose one',
                            RiskQuestion::MULTI => 'Choose several',
                        ])->default(RiskQuestion::SINGLE)->required()->native(false),
                        TextInput::make('weight')->integer()->minValue(1)->maxValue(10)->default(1)->required(),
                        Repeater::make('options')
                            ->schema([
                                TextInput::make('label')->required()->maxLength(500),
                                TextInput::make('value')->required()->maxLength(64),
                                TextInput::make('score')->integer()->minValue(-10)->maxValue(20)->default(0)->required(),
                            ])
                            ->columns(3)
                            ->minItems(2)
                            ->columnSpanFull(),
                    ])
                    ->columns(3)
                    ->minItems(1)
                    ->columnSpanFull(),
            ]),
            Section::make('Risk bands')
                ->description('Score ranges must cover every possible total. The label shown to staff and clients is set here.')
                ->schema([
                    Repeater::make('bands')
                        ->schema([
                            TextInput::make('key')->required()->maxLength(64),
                            TextInput::make('label')->required()->maxLength(64),
                            TextInput::make('min_score')->integer()->required(),
                            TextInput::make('max_score')->integer()->required(),
                            Textarea::make('description')->rows(2)->maxLength(500)->columnSpanFull(),
                        ])
                        ->columns(4)
                        ->minItems(2)
                        ->columnSpanFull(),
                ]),
        ];
    }

    private static function prefill(RiskQuestionnaire $questionnaire): array
    {
        $latest = $questionnaire->versions()->with('questions.options')->first();

        if ($latest === null) {
            return ['methodology_version' => $questionnaire->code.'-1.0', 'valid_for_days' => 365];
        }

        return [
            'methodology_version' => $latest->methodology_version,
            'valid_for_days' => $latest->valid_for_days,
            'bands' => $latest->bands,
            'questions' => $latest->questions->map(fn (RiskQuestion $question) => [
                'code' => $question->code,
                'text' => $question->text,
                'type' => $question->type,
                'weight' => $question->weight,
                'options' => $question->options->map(fn ($option) => [
                    'label' => $option->label,
                    'value' => $option->value,
                    'score' => $option->score,
                ])->all(),
            ])->all(),
        ];
    }

    private static function createVersion(RiskQuestionnaire $questionnaire, array $data): RiskQuestionnaireVersion
    {
        self::assertBandsCoverScores($data);

        return DB::transaction(function () use ($questionnaire, $data): RiskQuestionnaireVersion {
            $version = new RiskQuestionnaireVersion([
                'risk_questionnaire_id' => $questionnaire->id,
                'version' => ((int) $questionnaire->versions()->max('version')) + 1,
                'methodology_version' => $data['methodology_version'],
                'valid_for_days' => $data['valid_for_days'] ?? null,
                'bands' => array_values($data['bands']),
                'created_by' => auth()->id(),
            ]);
            $version->save();

            $order = 0;

            foreach ($data['questions'] as $questionData) {
                $question = RiskQuestion::create([
                    'risk_questionnaire_version_id' => $version->id,
                    'code' => $questionData['code'],
                    'text' => $questionData['text'],
                    'type' => $questionData['type'],
                    'weight' => $questionData['weight'],
                    'sort_order' => $order++,
                    'is_required' => true,
                ]);

                $optionOrder = 0;

                foreach ($questionData['options'] as $optionData) {
                    $question->options()->create([
                        'label' => $optionData['label'],
                        'value' => $optionData['value'],
                        'score' => $optionData['score'],
                        'sort_order' => $optionOrder++,
                    ]);
                }
            }

            app(AuditLogger::class)->record('risk_questionnaire.drafted', $version, new: ['version' => $version->version]);

            return $version;
        });
    }

    private static function publishLatestDraft(RiskQuestionnaire $questionnaire): RiskQuestionnaireVersion
    {
        $draft = $questionnaire->versions()->where('status', RiskQuestionnaireVersion::DRAFT)->with('questions.options')->first();

        if ($draft === null) {
            throw ApiException::unprocessable('NO_DRAFT', 'There is no draft version to publish.');
        }

        if ($draft->questions->isEmpty()) {
            throw ApiException::unprocessable('NO_QUESTIONS', 'Add at least one question before publishing.');
        }

        if ($draft->bandFor($draft->maxScore()) === null || $draft->bandFor(0) === null) {
            throw ApiException::unprocessable('BANDS_INCOMPLETE', 'The bands must cover every score from 0 to '.$draft->maxScore().'.');
        }

        return DB::transaction(function () use ($questionnaire, $draft): RiskQuestionnaireVersion {
            $questionnaire->versions()
                ->where('status', RiskQuestionnaireVersion::PUBLISHED)
                ->each(fn (RiskQuestionnaireVersion $current) => $current->forceFill(['status' => RiskQuestionnaireVersion::RETIRED])->save());

            $draft->forceFill([
                'status' => RiskQuestionnaireVersion::PUBLISHED,
                'published_by' => auth()->id(),
                'published_at' => now(),
            ])->save();

            app(AuditLogger::class)->record('risk_questionnaire.published', $draft, new: ['version' => $draft->version]);

            return $draft;
        });
    }

    private static function assertBandsCoverScores(array $data): void
    {
        $bands = collect($data['bands'] ?? []);

        if ($bands->isEmpty()) {
            throw ApiException::unprocessable('BANDS_REQUIRED', 'Define at least one risk band.');
        }

        foreach ($bands as $band) {
            if ((int) $band['min_score'] > (int) $band['max_score']) {
                throw ApiException::unprocessable('BAND_RANGE_INVALID', 'A band has a minimum above its maximum.');
            }
        }

        if ($bands->pluck('key')->duplicates()->isNotEmpty()) {
            throw ApiException::unprocessable('BAND_KEYS_DUPLICATED', 'Band keys must be unique.');
        }
    }

    public static function getPages(): array
    {
        return ['index' => ManageRiskQuestionnaires::route('/')];
    }
}
