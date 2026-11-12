<?php

namespace App\Filament\Resources\FreeTrials;

use App\Domain\Crm\TrialLifecycleService;
use App\Filament\Resources\FreeTrials\Pages\ManageFreeTrials;
use App\Filament\Support\DomainAction;
use App\Models\FreeTrial;
use App\Models\Lead;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class FreeTrialResource extends Resource
{
    protected static ?string $model = FreeTrial::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSparkles;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?string $navigationLabel = 'Demo / Free trials';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public static function canCreate(): bool
    {
        return false;
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
        return parent::getEloquentQuery()->with(['lead', 'employee.user'])->whereIn('lead_id', Lead::query()->visibleTo(auth()->user())->select('id'));
    }

    public static function requestSchema(): array
    {
        return [
            Select::make('lead_id')->label('Lead')->required()->searchable()
                ->options(fn () => Lead::query()->visibleTo(auth()->user())->latest('id')->limit(50)->pluck('full_name', 'id'))
                ->getSearchResultsUsing(fn (string $search) => Lead::query()->visibleTo(auth()->user())->where(fn ($q) => $q->where('full_name', 'like', '%'.$search.'%')->orWhere('mobile', 'like', '%'.$search.'%'))->limit(50)->pluck('full_name', 'id')),
            Select::make('trial_type')->options(['equity' => 'Equity', 'index_options' => 'Index options', 'commodity' => 'Commodity', 'combo' => 'Combo'])->required()->default('index_options'),
            DatePicker::make('start_date')->required()->default(fn () => app(TrialLifecycleService::class)->defaultDates()['start_date']),
            DatePicker::make('end_date')->required()->afterOrEqual('start_date')->default(fn () => app(TrialLifecycleService::class)->defaultDates()['end_date']),
            Textarea::make('scope_description')->label('Scope and limitations')->maxLength(1000),
        ];
    }

    public static function table(Table $table): Table
    {
        return $table->defaultSort('id', 'desc')->columns([
            TextColumn::make('trial_code')->label('Trial reference'), TextColumn::make('lead.full_name')->searchable(),
            TextColumn::make('trial_type')->badge(), TextColumn::make('status')->badge(), TextColumn::make('start_date')->date(),
            TextColumn::make('end_date')->date(), TextColumn::make('employee.user.name')->label('Owner'), TextColumn::make('client_feedback')->wrap()->limit(100),
        ])->filters([SelectFilter::make('status')->options(['requested' => 'Requested', 'approved' => 'Approved / awaiting session', 'active' => 'Active', 'completed' => 'Completed', 'converted' => 'Converted', 'cancelled' => 'Cancelled'])])
            ->headerActions([
                Action::make('requestTrial')->label('Request demo')->visible(fn (): bool => auth()->user()->can('leads.update'))->schema(self::requestSchema())
                    ->action(fn (array $data, Action $action) => DomainAction::run($action, fn () => app(TrialLifecycleService::class)->request(auth()->user(), $data), 'Demo request recorded')),
            ])->recordActions([
                Action::make('approve')->label('Approve activation')->visible(fn (FreeTrial $record): bool => auth()->user()->can('approve', $record))->requiresConfirmation()
                    ->modalDescription('This approves the trial entitlement. Activation and first-session feedback are scheduled from the trading calendar; outbound messages still require consent and approved Meta templates.')
                    ->action(fn (FreeTrial $record, Action $action) => DomainAction::run($action, fn () => app(TrialLifecycleService::class)->approve(auth()->user(), $record), 'Trial approved')),
                Action::make('cancel')->color('danger')->visible(fn (FreeTrial $record): bool => auth()->user()->can('cancel', $record))
                    ->schema([Textarea::make('reason')->required()->minLength(10)->maxLength(500)])
                    ->action(fn (FreeTrial $record, array $data, Action $action) => DomainAction::run($action, fn () => app(TrialLifecycleService::class)->cancel(auth()->user(), $record, $data['reason']), 'Trial cancelled')),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageFreeTrials::route('/')];
    }
}
