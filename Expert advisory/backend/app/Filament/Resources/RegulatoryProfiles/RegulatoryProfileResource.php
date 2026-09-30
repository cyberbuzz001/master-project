<?php

namespace App\Filament\Resources\RegulatoryProfiles;

use App\Domain\Compliance\RegulatoryProfileService;
use App\Filament\Resources\RegulatoryProfiles\Pages\ManageRegulatoryProfiles;
use App\Filament\Support\DomainAction;
use App\Models\RegulatoryProfileVersion;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use UnitEnum;

class RegulatoryProfileResource extends Resource
{
    protected static ?string $model = RegulatoryProfileVersion::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedScale;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 1;

    protected static ?string $navigationLabel = 'Regulatory profile';

    protected static ?string $modelLabel = 'regulatory profile version';

    protected static ?string $slug = 'regulatory-profile';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('regulatory_profile.view');
    }

    public static function canCreate(): bool
    {
        return false; // created via the audited header action
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['creator:id,name', 'verifier:id,name']);
    }

    public static function getNavigationBadge(): ?string
    {
        $pending = RegulatoryProfileVersion::query()->where('status', RegulatoryProfileVersion::PENDING)->count();

        return $pending > 0 ? (string) $pending : null;
    }

    /**
     * @return array<int, mixed>
     */
    public static function profileSchema(): array
    {
        $registered = fn (Get $get) => in_array($get('entity_type'), ['sebi_registered_ra', 'research_entity'], true);

        return [
            Section::make('Entity')->columns(2)->schema([
                Select::make('entity_type')->label('Operating structure')->options(RegulatoryProfileVersion::ENTITY_TYPES)->required()->live()->native(false),
                TextInput::make('legal_entity_name')->maxLength(255),
                TextInput::make('brand_name')->maxLength(255),
                TextInput::make('research_status')->label('Research status (as registered)')->maxLength(255),
            ]),
            Section::make('Registration')
                ->description('Enter only what you can evidence from the registration certificate and the regulator\'s public register.')
                ->columns(2)
                ->visible($registered)
                ->schema([
                    TextInput::make('registration_number')->maxLength(64)->regex('/^[A-Z0-9\/\-]+$/')->dehydrateStateUsing(fn (?string $state) => $state ? strtoupper(trim($state)) : null),
                    DatePicker::make('registration_date')->maxDate(now()),
                    DatePicker::make('registration_valid_until'),
                    TextInput::make('ra_name')->label('Research Analyst name')->maxLength(255),
                    TextInput::make('ra_contact_email')->label('Research Analyst email')->email()->maxLength(255),
                    TextInput::make('ra_contact_phone')->label('Research Analyst phone')->maxLength(32),
                ]),
            Section::make('Partner Research Analyst')
                ->columns(3)
                ->visible(fn (Get $get) => $get('entity_type') === 'partner_associated_ra')
                ->schema([
                    TextInput::make('partner_ra.name')->label('Legal name')->maxLength(255),
                    TextInput::make('partner_ra.registration_number')->label('Registration number')->maxLength(64)->regex('/^[A-Z0-9\/\-]+$/'),
                    TextInput::make('partner_ra.agreement_reference')->label('Agreement reference')->maxLength(255),
                ]),
            Section::make('Responsible people')->columns(2)->schema([
                TextInput::make('principal_officer')->maxLength(255),
                TextInput::make('compliance_officer')->maxLength(255),
                TextInput::make('grievance_officer_name')->maxLength(255),
                TextInput::make('grievance_officer_email')->email()->maxLength(255),
                TextInput::make('grievance_officer_phone')->maxLength(32),
            ]),
            Section::make('Policy switches')->columns(3)->schema([
                Toggle::make('research_approval_required')->default(true),
                Toggle::make('personalized_advice_allowed')->default(false),
                Select::make('performance_claim_policy')->options(['none' => 'No performance claims', 'ledger_only' => 'Ledger-based performance only'])->default('none')->required()->native(false),
            ]),
            Section::make('Publication')->schema([
                Textarea::make('public_statement')->label('Public statement (Trust Center, once verified)')->rows(3)->maxLength(2000),
                DatePicker::make('review_due_at')->label('Next review date')->minDate(now()->addDay()),
            ]),
        ];
    }

    public static function table(Table $table): Table
    {
        $service = app(RegulatoryProfileService::class);

        return $table
            ->defaultSort('version', 'desc')
            ->columns([
                TextColumn::make('version')->label('v')->sortable(),
                TextColumn::make('entity_type')->label('Structure')->formatStateUsing(fn (string $state) => RegulatoryProfileVersion::ENTITY_TYPES[$state] ?? $state),
                TextColumn::make('legal_entity_name')->label('Legal entity')->placeholder('—'),
                TextColumn::make('registration')->state(fn (RegulatoryProfileVersion $record) => $record->registration_number ?? ($record->partner_ra['registration_number'] ?? null))->placeholder('—')->fontFamily('mono'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    RegulatoryProfileVersion::VERIFIED => 'success',
                    RegulatoryProfileVersion::PENDING => 'warning',
                    RegulatoryProfileVersion::REJECTED => 'danger',
                    default => 'gray',
                }),
                TextColumn::make('creator.name')->label('Drafted by')->placeholder('—'),
                TextColumn::make('verifier.name')->label('Verified by')->placeholder('—'),
                TextColumn::make('review_due_at')->label('Review due')->date('d M Y')->placeholder('—'),
            ])
            ->recordActions([
                ActionGroup::make([
                    Action::make('details')
                        ->icon(Heroicon::OutlinedEye)
                        ->modalSubmitAction(false)
                        ->modalHeading(fn (RegulatoryProfileVersion $record) => 'Version '.$record->version)
                        ->modalContent(fn (RegulatoryProfileVersion $record) => new HtmlString(self::detailsHtml($record))),
                    Action::make('editDraft')
                        ->label('Edit draft')
                        ->icon(Heroicon::OutlinedPencilSquare)
                        ->modalWidth('4xl')
                        ->visible(fn (RegulatoryProfileVersion $record) => $record->status === RegulatoryProfileVersion::DRAFT && auth()->user()->can('regulatory_profile.edit'))
                        ->fillForm(fn (RegulatoryProfileVersion $record) => $record->attributesToArray())
                        ->schema(self::profileSchema())
                        ->action(fn (array $data, RegulatoryProfileVersion $record, Action $action) => DomainAction::run($action,
                            fn () => $service->updateDraft(auth()->user(), $record, $data), 'Draft saved')),
                    Action::make('submit')
                        ->label('Submit for verification')
                        ->icon(Heroicon::OutlinedPaperAirplane)
                        ->requiresConfirmation()
                        ->visible(fn (RegulatoryProfileVersion $record) => $record->status === RegulatoryProfileVersion::DRAFT && auth()->user()->can('regulatory_profile.edit'))
                        ->action(fn (RegulatoryProfileVersion $record, Action $action) => DomainAction::run($action,
                            fn () => $service->submit(auth()->user(), $record), 'Submitted for verification')),
                    Action::make('verify')
                        ->label('Verify & activate')
                        ->icon(Heroicon::OutlinedCheckBadge)
                        ->color('success')
                        ->visible(fn (RegulatoryProfileVersion $record) => $record->status === RegulatoryProfileVersion::PENDING && auth()->user()->can('regulatory_profile.verify'))
                        ->modalDescription('Check every field against source documents. Verifying activates this version and publishes it in the Trust Center.')
                        ->schema([Textarea::make('verification_evidence')->label('Evidence checked')->required()->minLength(10)->maxLength(1000)->rows(3)])
                        ->action(fn (array $data, RegulatoryProfileVersion $record, Action $action) => DomainAction::run($action,
                            fn () => $service->verify(auth()->user(), $record, $data['verification_evidence']), 'Regulatory profile verified')),
                    Action::make('reject')
                        ->icon(Heroicon::OutlinedXCircle)
                        ->color('danger')
                        ->visible(fn (RegulatoryProfileVersion $record) => $record->status === RegulatoryProfileVersion::PENDING && auth()->user()->can('regulatory_profile.verify'))
                        ->schema([Textarea::make('reason')->required()->minLength(5)->maxLength(1000)->rows(2)])
                        ->action(fn (array $data, RegulatoryProfileVersion $record, Action $action) => DomainAction::run($action,
                            fn () => $service->reject(auth()->user(), $record, $data['reason']), 'Version rejected')),
                ]),
            ]);
    }

    private static function detailsHtml(RegulatoryProfileVersion $record): string
    {
        $rows = [
            'Structure' => RegulatoryProfileVersion::ENTITY_TYPES[$record->entity_type] ?? $record->entity_type,
            'Legal entity' => $record->legal_entity_name,
            'Registration number' => $record->registration_number,
            'Registration date' => $record->registration_date?->toDateString(),
            'Valid until' => $record->registration_valid_until?->toDateString(),
            'Research Analyst' => $record->ra_name,
            'Partner RA' => collect($record->partner_ra ?? [])->filter()->join(' · '),
            'Compliance officer' => $record->compliance_officer,
            'Grievance officer' => collect([$record->grievance_officer_name, $record->grievance_officer_email, $record->grievance_officer_phone])->filter()->join(' · '),
            'Public statement' => $record->public_statement,
            'Review due' => $record->review_due_at?->toDateString(),
            'Verification evidence' => $record->verification_evidence,
            'Rejection reason' => $record->rejection_reason,
        ];

        $html = '<ul class="esc-rows">';
        foreach ($rows as $label => $value) {
            $html .= '<li><span class="esc-meta">'.e($label).'</span><span class="esc-body esc-end">'.e(filled($value) ? $value : '—').'</span></li>';
        }

        return $html.'</ul>';
    }

    public static function getPages(): array
    {
        return ['index' => ManageRegulatoryProfiles::route('/')];
    }
}
