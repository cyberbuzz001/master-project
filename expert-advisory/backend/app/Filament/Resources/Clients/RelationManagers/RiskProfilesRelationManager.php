<?php

namespace App\Filament\Resources\Clients\RelationManagers;

use App\Domain\Onboarding\DocumentVault;
use App\Domain\Onboarding\RiskProfileService;
use App\Domain\Onboarding\RiskReportGenerator;
use App\Filament\Support\DomainAction;
use App\Models\RiskProfile;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class RiskProfilesRelationManager extends RelationManager
{
    protected static string $relationship = 'riskProfiles';

    protected static ?string $title = 'Risk assessments';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedChartBar;

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()->can('viewRisk', $ownerRecord);
    }

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $service = app(RiskProfileService::class);

        return $table
            ->description('Assessments are immutable. A change of circumstances means a new assessment, not an edit.')
            ->columns([
                TextColumn::make('created_at')->label('Taken')->dateTime('d M Y, h:i A', $tz)->sortable(),
                TextColumn::make('risk_category')->label('Category')->badge()->color('info')
                    ->formatStateUsing(fn (string $state, RiskProfile $record) => $record->questionnaireVersion->bandLabels()[$state] ?? $state),
                TextColumn::make('score')->label('Score')->state(fn (RiskProfile $record) => $record->raw_score.' / '.$record->max_score),
                TextColumn::make('methodology_version')->label('Methodology'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    RiskProfile::FINALIZED => 'success',
                    RiskProfile::SUPERSEDED => 'gray',
                    default => 'warning',
                }),
                TextColumn::make('acknowledged_at')->label('Client acknowledged')->dateTime('d M Y', $tz)->placeholder('Not yet'),
                TextColumn::make('expires_at')->label('Review by')->date('d M Y', $tz)->placeholder('—')
                    ->color(fn (RiskProfile $record) => $record->isExpired() ? 'danger' : null),
            ])
            ->recordActions([
                Action::make('answers')
                    ->label('Answers')
                    ->icon(Heroicon::OutlinedListBullet)
                    ->color('gray')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (RiskProfile $record) => view('filament.clients.risk-answers', ['profile' => $record])),
                Action::make('report')
                    ->label('Report')
                    ->icon(Heroicon::OutlinedArrowDownTray)
                    ->color('gray')
                    ->visible(fn (RiskProfile $record) => auth()->user()->can('documents.download') && app(RiskReportGenerator::class)->documentFor($record) !== null)
                    ->url(fn (RiskProfile $record) => app(DocumentVault::class)->temporaryUrl(auth()->user(), app(RiskReportGenerator::class)->documentFor($record)))
                    ->openUrlInNewTab(),
                Action::make('acknowledge')
                    ->label('Record acknowledgement')
                    ->icon(Heroicon::OutlinedHandThumbUp)
                    ->requiresConfirmation()
                    ->modalDescription('Confirm the client was shown the outcome and agreed it reflects their circumstances.')
                    ->visible(fn (RiskProfile $record) => $record->acknowledged_at === null && $record->status === RiskProfile::SUBMITTED && auth()->user()->can('assess', $this->getOwnerRecord()))
                    ->action(fn (RiskProfile $record, Action $action) => DomainAction::run($action, fn () => $service->acknowledge($record, auth()->user()), 'Acknowledgement recorded')),
                Action::make('finalize')
                    ->label('Sign off')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (RiskProfile $record) => $record->status === RiskProfile::SUBMITTED && auth()->user()->can('assess', $this->getOwnerRecord()))
                    ->action(fn (RiskProfile $record, Action $action) => DomainAction::run($action, fn () => $service->finalize(auth()->user(), $record), 'Risk profile signed off')),
                Action::make('override')
                    ->label('Override category')
                    ->icon(Heroicon::OutlinedAdjustmentsHorizontal)
                    ->color('warning')
                    ->visible(fn (RiskProfile $record) => auth()->user()->can('risk_profile.override') && $record->status !== RiskProfile::SUPERSEDED)
                    ->schema(fn (RiskProfile $record) => [
                        Select::make('category')->label('New category')->options($record->questionnaireVersion->bandLabels())->required()->native(false),
                        Textarea::make('reason')->label('Why does the score not fit?')->required()->minLength(10)->maxLength(2000)->rows(3),
                    ])
                    ->action(fn (array $data, RiskProfile $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $service->override(auth()->user(), $record, $data['category'], $data['reason']),
                        'Category overridden',
                    )),
            ]);
    }
}
