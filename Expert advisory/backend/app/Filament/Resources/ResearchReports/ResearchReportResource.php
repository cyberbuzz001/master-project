<?php

namespace App\Filament\Resources\ResearchReports;

use App\Domain\Research\ResearchWorkflowService;
use App\Filament\Resources\ResearchReports\Pages\CreateResearchReport;
use App\Filament\Resources\ResearchReports\Pages\ListResearchReports;
use App\Filament\Resources\ResearchReports\Pages\ViewResearchReport;
use App\Filament\Support\DomainAction;
use App\Models\MarketDataSnapshot;
use App\Models\ResearchRecommendation;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Checkbox;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Colors\Color;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class ResearchReportResource extends Resource
{
    protected static ?string $model = ResearchReport::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentChartBar;

    protected static string|UnitEnum|null $navigationGroup = 'Research Desk';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'title';

    public const STATUS_COLORS = [
        ResearchVersion::STATUS_DRAFT => 'gray',
        ResearchVersion::STATUS_AI_REVIEW => 'info',
        ResearchVersion::STATUS_COMPLIANCE_REVIEW => 'warning',
        ResearchVersion::STATUS_ANALYST_REVIEW => 'primary',
        ResearchVersion::STATUS_APPROVED => 'primary',
        ResearchVersion::STATUS_PUBLISHED => 'success',
        ResearchVersion::STATUS_REJECTED => 'danger',
        ResearchVersion::STATUS_EXPIRED => 'gray',
        ResearchVersion::STATUS_ARCHIVED => 'gray',
    ];

    public static function canViewAny(): bool
    {
        return auth()->user()->can('research.view_internal');
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('research.create');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('report_code')
                    ->label('Code')
                    ->searchable()
                    ->sortable()
                    ->copyable()
                    ->weight('bold'),
                TextColumn::make('title')
                    ->searchable()
                    ->limit(40)
                    ->tooltip(fn (ResearchReport $record) => $record->title),
                TextColumn::make('report_type')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => ResearchReport::TYPES[$state] ?? ucfirst($state)),
                TextColumn::make('category')
                    ->badge()
                    ->color('gray')
                    ->formatStateUsing(fn (string $state) => ResearchReport::CATEGORIES[$state] ?? ucfirst($state)),
                TextColumn::make('currentVersion.version')
                    ->label('Version')
                    ->prefix('v')
                    ->alignCenter(),
                TextColumn::make('currentVersion.status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (?string $state) => self::STATUS_COLORS[$state] ?? 'gray')
                    ->formatStateUsing(fn (?string $state) => ResearchVersion::STATUSES[$state] ?? ucfirst(strtolower($state ?? ''))),
                TextColumn::make('currentVersion.author.user.name')
                    ->label('Author')
                    ->toggleable(),
                TextColumn::make('currentVersion.published_at')
                    ->label('Published')
                    ->dateTime('d M Y H:i')
                    ->placeholder('Unpublished')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('report_type')->options(ResearchReport::TYPES),
                SelectFilter::make('category')->options(ResearchReport::CATEGORIES),
            ])
            ->actions([
                ViewAction::make(),
                ActionGroup::make([
                    Action::make('submit_for_review')
                        ->label('Submit for review')
                        ->icon(Heroicon::OutlinedPaperAirplane)
                        ->color('info')
                        ->visible(fn (ResearchReport $record) => $record->currentVersion?->status === ResearchVersion::STATUS_DRAFT)
                        ->form([
                            Select::make('data_snapshot_id')
                                ->label('Attach Market Data Snapshot')
                                ->options(fn () => MarketDataSnapshot::query()->latest('id')->limit(30)->get()->mapWithKeys(
                                    fn ($s) => [$s->id => "{$s->symbol} ({$s->exchange}) - LTP: {$s->payload['ltp']} [{$s->as_of->toDateTimeString()}]"]
                                ))
                                ->required()
                                ->default(fn (ResearchReport $record) => $record->currentVersion?->data_snapshot_id),
                        ])
                        ->action(function (ResearchReport $record, array $data, Action $action) {
                            $version = $record->currentVersion;
                            if ($version === null) {
                                return;
                            }
                            $version->update(['data_snapshot_id' => $data['data_snapshot_id']]);
                            DomainAction::run(
                                $action,
                                fn () => app(ResearchWorkflowService::class)->submitForReview(auth()->user(), $version->fresh()),
                                'Submitted for review (AI & Compliance)'
                            );
                        }),

                    Action::make('compliance_review')
                        ->label('Compliance review')
                        ->icon(Heroicon::OutlinedShieldCheck)
                        ->color('warning')
                        ->visible(fn (ResearchReport $record) => $record->currentVersion?->status === ResearchVersion::STATUS_COMPLIANCE_REVIEW && auth()->user()->can('research.compliance_review'))
                        ->form([
                            Select::make('decision')
                                ->label('Decision')
                                ->options([
                                    'CLEAR' => 'Clear / Approve Disclosures',
                                    'REQUEST_CHANGES' => 'Request Changes (Return to Draft)',
                                    'REJECT' => 'Reject Report',
                                ])
                                ->required(),
                            Textarea::make('comment')
                                ->label('Review Comments / Rejection Reason')
                                ->rows(3),
                            Checkbox::make('has_conflict_of_interest')
                                ->label('Author has declared a material conflict of interest')
                                ->default(false),
                            TextInput::make('conflict_details')
                                ->label('Conflict Details (if declared)'),
                        ])
                        ->action(function (ResearchReport $record, array $data, Action $action) {
                            $version = $record->currentVersion;
                            if ($version === null) {
                                return;
                            }
                            DomainAction::run(
                                $action,
                                fn () => app(ResearchWorkflowService::class)->complianceReview(
                                    auth()->user(),
                                    $version,
                                    $data['decision'],
                                    $data['comment'] ?? null,
                                    [
                                        'has_conflict_of_interest' => (bool) ($data['has_conflict_of_interest'] ?? false),
                                        'conflict_details' => $data['conflict_details'] ?? null,
                                    ]
                                ),
                                'Compliance review recorded'
                            );
                        }),

                    Action::make('analyst_approve')
                        ->label('Analyst approve')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->color('success')
                        ->visible(fn (ResearchReport $record) => $record->currentVersion?->status === ResearchVersion::STATUS_ANALYST_REVIEW && auth()->user()->can('research.approve'))
                        ->form([
                            Textarea::make('comment')
                                ->label('Approval Notes & Technical Grounds')
                                ->required()
                                ->rows(3),
                        ])
                        ->action(function (ResearchReport $record, array $data, Action $action) {
                            $version = $record->currentVersion;
                            if ($version === null) {
                                return;
                            }
                            DomainAction::run(
                                $action,
                                fn () => app(ResearchWorkflowService::class)->analystApprove(auth()->user(), $version, $data['comment']),
                                'Research report approved'
                            );
                        }),

                    Action::make('publish_report')
                        ->label('Publish to clients')
                        ->icon(Heroicon::OutlinedMegaphone)
                        ->color('success')
                        ->requiresConfirmation()
                        ->modalHeading('Publish Research Report')
                        ->modalDescription('Publishing makes this version immutable, broadcasts it to eligible clients according to suitability, and initiates the performance tracking ledger.')
                        ->visible(fn (ResearchReport $record) => $record->currentVersion?->status === ResearchVersion::STATUS_APPROVED && auth()->user()->can('research.publish'))
                        ->action(function (ResearchReport $record, Action $action) {
                            $version = $record->currentVersion;
                            if ($version === null) {
                                return;
                            }
                            DomainAction::run(
                                $action,
                                fn () => app(ResearchWorkflowService::class)->publish(auth()->user(), $version),
                                'Research report published and distributed'
                            );
                        }),

                    Action::make('create_new_version')
                        ->label('Draft next version (n+1)')
                        ->icon(Heroicon::OutlinedDocumentPlus)
                        ->requiresConfirmation()
                        ->visible(fn (ResearchReport $record) => $record->currentVersion?->status === ResearchVersion::STATUS_PUBLISHED && auth()->user()->can('research.create'))
                        ->action(function (ResearchReport $record, Action $action) {
                            DomainAction::run(
                                $action,
                                fn () => app(ResearchWorkflowService::class)->createNewVersion(auth()->user(), $record),
                                'New draft version created'
                            );
                        }),
                ]),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Report Overview')
                    ->schema([
                        Grid::make(4)->schema([
                            TextEntry::make('report_code')->label('Report code')->weight('bold'),
                            TextEntry::make('title')->label('Title'),
                            TextEntry::make('report_type')->label('Type')
                                ->badge()
                                ->formatStateUsing(fn (string $state) => ResearchReport::TYPES[$state] ?? ucfirst($state)),
                            TextEntry::make('category')->label('Category')
                                ->badge()
                                ->formatStateUsing(fn (string $state) => ResearchReport::CATEGORIES[$state] ?? ucfirst($state)),
                        ]),
                        Grid::make(4)->schema([
                            TextEntry::make('currentVersion.version')->label('Current version')->prefix('v'),
                            TextEntry::make('currentVersion.status')->label('Status')
                                ->badge()
                                ->color(fn (?string $state) => self::STATUS_COLORS[$state] ?? 'gray')
                                ->formatStateUsing(fn (?string $state) => ResearchVersion::STATUSES[$state] ?? ucfirst(strtolower($state ?? ''))),
                            TextEntry::make('currentVersion.author.user.name')->label('Author'),
                            TextEntry::make('currentVersion.published_at')->label('Published at')->dateTime('d M Y H:i')->placeholder('Not published'),
                        ]),
                        TextEntry::make('currentVersion.summary')->label('Executive Summary')->columnSpanFull(),
                        TextEntry::make('currentVersion.body')->label('Analysis Body')->columnSpanFull(),
                    ]),

                Section::make('Recommendations')
                    ->schema([
                        RepeatableEntry::make('currentVersion.recommendations')
                            ->schema([
                                TextEntry::make('instrument')->label('Symbol')->weight('bold'),
                                TextEntry::make('direction')->badge()->color(fn (string $state) => $state === 'BUY' ? 'success' : 'danger'),
                                TextEntry::make('entryReference')->label('Entry Ref'),
                                TextEntry::make('stop_loss')->label('Stop Loss'),
                                TextEntry::make('targets')->label('Targets')->formatStateUsing(fn ($state) => is_array($state) ? implode(', ', $state) : (string) $state),
                                TextEntry::make('risk_classification')->label('Risk')->badge(),
                                TextEntry::make('status')->label('Outcome / Status')->badge(),
                            ])
                            ->columns(7),
                    ]),

                Section::make('Compliance & Cryptographic Verification')
                    ->schema([
                        Grid::make(2)->schema([
                            TextEntry::make('currentVersion.content_hash')->label('Content SHA-256 Hash')->fontFamily('mono')->placeholder('Unpublished'),
                            TextEntry::make('currentVersion.disclosure_set_hash')->label('Disclosure Set SHA-256 Hash')->fontFamily('mono')->placeholder('Pending review'),
                        ]),
                        Grid::make(2)->schema([
                            TextEntry::make('currentVersion.complianceReviewer.name')->label('Compliance Reviewer')->placeholder('Pending'),
                            TextEntry::make('currentVersion.approver.name')->label('Authorized Analyst Approver')->placeholder('Pending'),
                        ]),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListResearchReports::route('/'),
            'create' => CreateResearchReport::route('/create'),
            'view' => ViewResearchReport::route('/{record}'),
        ];
    }
}
