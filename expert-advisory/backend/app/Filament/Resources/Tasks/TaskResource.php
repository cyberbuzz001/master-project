<?php

namespace App\Filament\Resources\Tasks;

use App\Domain\Crm\LeadAssignmentService;
use App\Filament\Resources\Tasks\Pages\ManageTasks;
use App\Models\Employee;
use App\Models\Task;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class TaskResource extends Resource
{
    protected static ?string $model = Task::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClipboardDocumentCheck;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 3;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->visibleTo(auth()->user())->with(['assignee.user:id,name', 'creator:id,name']);
    }

    public static function getNavigationBadge(): ?string
    {
        $employeeId = auth()->user()?->employee?->id;
        if ($employeeId === null) {
            return null;
        }

        $open = Task::query()->where('assignee_employee_id', $employeeId)->where('status', 'open')->count();

        return $open > 0 ? (string) $open : null;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->columns(2)->components([
            TextInput::make('title')->required()->maxLength(255)->columnSpanFull(),
            Textarea::make('description')->rows(3)->maxLength(5000)->columnSpanFull(),
            Select::make('assignee_employee_id')
                ->label('Assign to')
                ->options(function () {
                    $user = auth()->user();
                    $options = app(LeadAssignmentService::class)->assignableEmployees($user)->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]);
                    if ($user->employee) {
                        $options->put($user->employee->id, $user->employee->displayName().' (me)');
                    }

                    return $options->all();
                })
                ->default(fn () => auth()->user()?->employee?->id)
                ->required()
                ->searchable(),
            DateTimePicker::make('due_at')->seconds(false)->timezone(config('platform.timezone_display')),
            Select::make('priority')->options(['low' => 'Low', 'normal' => 'Normal', 'high' => 'High'])->default('normal')->required()->native(false),
        ]);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('due_at')
            ->columns([
                TextColumn::make('title')->searchable()->weight('medium')->description(fn (Task $record) => str($record->description)->limit(80)),
                TextColumn::make('priority')->badge()->color(fn (string $state) => match ($state) {
                    'high' => 'danger',
                    'low' => 'gray',
                    default => 'info',
                }),
                TextColumn::make('status')->badge()->color(fn (string $state) => $state === 'done' ? 'success' : ($state === 'open' ? 'warning' : 'gray')),
                TextColumn::make('due_at')->dateTime('d M Y, h:i A', $tz)->sortable()->placeholder('—')
                    ->color(fn (Task $record) => $record->status === 'open' && $record->due_at?->isPast() ? 'danger' : null),
                TextColumn::make('assignee.user.name')->label('Assignee'),
                TextColumn::make('creator.name')->label('Created by')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')->options(['open' => 'Open', 'done' => 'Done', 'cancelled' => 'Cancelled'])->default('open'),
                SelectFilter::make('priority')->options(['low' => 'Low', 'normal' => 'Normal', 'high' => 'High']),
            ])
            ->recordActions([
                Action::make('complete')
                    ->label('Done')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->visible(fn (Task $record) => $record->status === 'open' && auth()->user()->can('update', $record))
                    ->action(fn (Task $record) => $record->forceFill(['status' => 'done', 'completed_at' => now()])->save()),
                EditAction::make()->visible(fn (Task $record) => $record->status === 'open'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTasks::route('/'),
        ];
    }
}
