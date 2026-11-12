<?php

namespace App\Filament\Resources\ScheduledActions;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\ScheduledActions\Pages\ManageScheduledActions;
use App\Models\Lead;
use App\Models\ScheduledAction;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use UnitEnum;

class ScheduledActionResource extends Resource
{
    protected static ?string $model = ScheduledAction::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedQueueList;

    protected static string|UnitEnum|null $navigationGroup = 'Communications';

    protected static ?string $navigationLabel = 'Automation outbox';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('automation.manage');
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
        return parent::getEloquentQuery()->with('lead')->whereIn('lead_id', Lead::query()->visibleTo(auth()->user())->select('id'));
    }

    public static function table(Table $table): Table
    {
        return $table->defaultSort('id', 'desc')->columns([
            TextColumn::make('lead.full_name')->searchable(), TextColumn::make('action_type')->badge(), TextColumn::make('status')->badge(),
            TextColumn::make('scheduled_for')->dateTime('d M Y H:i', 'Asia/Kolkata'), TextColumn::make('attempts'),
            TextColumn::make('execution_error')->wrap()->limit(150), TextColumn::make('provider_message_id')->toggleable(isToggledHiddenByDefault: true),
        ])->filters([SelectFilter::make('status')->options(['pending' => 'Pending', 'processing' => 'Processing', 'executed' => 'Accepted by provider', 'failed' => 'Rejected / blocked', 'review_required' => 'Reconciliation required', 'cancelled' => 'Cancelled'])])
            ->recordActions([
                Action::make('retryRejected')->label('Retry rejected send')->visible(fn (ScheduledAction $record): bool => $record->status === 'failed')
                    ->schema([Textarea::make('reason')->required()->minLength(10)->maxLength(500)])
                    ->action(function (ScheduledAction $record, array $data): void {
                        Gate::authorize('automation.manage');
                        Gate::authorize('update', $record->lead);
                        $changed = ScheduledAction::whereKey($record->id)->where('status', 'failed')->update(['status' => 'pending', 'scheduled_for' => now(), 'execution_error' => null]);
                        if ($changed) {
                            app(AuditLogger::class)->record('scheduled_action.retry_requested', $record, reason: $data['reason']);
                        }
                    }),
                Action::make('cancel')->color('danger')->visible(fn (ScheduledAction $record): bool => in_array($record->status, ['pending', 'failed', 'review_required'], true))
                    ->schema([Textarea::make('reason')->required()->minLength(10)->maxLength(500)])
                    ->action(function (ScheduledAction $record, array $data): void {
                        Gate::authorize('automation.manage');
                        Gate::authorize('update', $record->lead);
                        $changed = ScheduledAction::whereKey($record->id)->whereIn('status', ['pending', 'failed', 'review_required'])->update(['status' => 'cancelled', 'execution_error' => 'Cancelled by operator: '.$data['reason']]);
                        if ($changed) {
                            app(AuditLogger::class)->record('scheduled_action.cancelled', $record, reason: $data['reason']);
                        }
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageScheduledActions::route('/')];
    }
}
