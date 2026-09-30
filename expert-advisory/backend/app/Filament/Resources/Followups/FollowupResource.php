<?php

namespace App\Filament\Resources\Followups;

use App\Domain\Crm\LeadWorkflowService;
use App\Filament\Resources\Followups\Pages\ListFollowups;
use App\Filament\Resources\Leads\LeadResource;
use App\Filament\Support\DomainAction;
use App\Models\Followup;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class FollowupResource extends Resource
{
    protected static ?string $model = Followup::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCalendarDays;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 2;

    protected static ?string $navigationLabel = 'Follow-ups';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->visibleTo(auth()->user())->with(['lead:id,full_name,mobile,status', 'employee.user:id,name']);
    }

    public static function getNavigationBadge(): ?string
    {
        $due = static::getEloquentQuery()
            ->whereIn('status', [Followup::PENDING, Followup::MISSED])
            ->where('due_at', '<=', now(config('platform.timezone_display'))->endOfDay()->utc())
            ->count();

        return $due > 0 ? (string) $due : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Due today or overdue';
    }

    public static function table(Table $table): Table
    {
        return self::followupTable($table->defaultSort('due_at'), showLead: true);
    }

    public static function followupTable(Table $table, bool $showLead): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->columns(array_values(array_filter([
                $showLead ? TextColumn::make('lead.full_name')
                    ->label('Lead')
                    ->weight('medium')
                    ->description(fn (Followup $record) => $record->lead?->mobile)
                    ->url(fn (Followup $record) => LeadResource::getUrl('view', ['record' => $record->lead_id]))
                    ->searchable() : null,
                TextColumn::make('due_at')->label('Due')->dateTime('d M Y, h:i A', $tz)->sortable()
                    ->description(fn (Followup $record) => $record->due_at->since())
                    ->color(fn (Followup $record) => in_array($record->status, [Followup::PENDING, Followup::MISSED], true) && $record->due_at->isPast() ? 'danger' : null),
                TextColumn::make('channel')->badge()->color('gray')->formatStateUsing(fn (string $state) => Followup::CHANNELS[$state] ?? $state),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    Followup::PENDING => 'warning',
                    Followup::DONE => 'success',
                    Followup::MISSED => 'danger',
                    default => 'gray',
                }),
                TextColumn::make('employee.user.name')->label('Owner')->toggleable(),
                TextColumn::make('notes')->limit(80)->wrap()->placeholder('—')->toggleable(),
                TextColumn::make('outcome')->limit(80)->wrap()->placeholder('—')->toggleable(isToggledHiddenByDefault: true),
            ])))
            ->filters([
                SelectFilter::make('channel')->options(Followup::CHANNELS),
            ])
            ->recordActions([
                Action::make('complete')
                    ->label('Done')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->visible(fn (Followup $record) => in_array($record->status, [Followup::PENDING, Followup::MISSED], true) && auth()->user()->can('update', $record))
                    ->schema([Textarea::make('outcome')->label('What happened?')->required()->maxLength(500)->rows(2)])
                    ->action(fn (array $data, Followup $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => app(LeadWorkflowService::class)->completeFollowup(auth()->user(), $record, $data['outcome']),
                        'Follow-up completed',
                    )),
                Action::make('cancel')
                    ->label('Cancel')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('gray')
                    ->visible(fn (Followup $record) => $record->status === Followup::PENDING && auth()->user()->can('update', $record))
                    ->schema([Textarea::make('reason')->required()->maxLength(500)->rows(2)])
                    ->action(fn (array $data, Followup $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => app(LeadWorkflowService::class)->cancelFollowup(auth()->user(), $record, $data['reason']),
                        'Follow-up cancelled',
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListFollowups::route('/'),
        ];
    }
}
