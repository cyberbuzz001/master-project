<?php

namespace App\Filament\Resources\Grievances;

use App\Domain\Support\GrievanceService;
use App\Filament\Resources\Grievances\Pages\ManageGrievances;
use App\Models\Grievance;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class GrievanceResource extends Resource
{
    protected static ?string $model = Grievance::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShieldExclamation;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Grievance Redressal';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('complaints.view') ?? false;
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

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('tracking_number')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                TextColumn::make('complainant_name')
                    ->searchable(),
                TextColumn::make('email')
                    ->searchable(),
                TextColumn::make('category')
                    ->badge(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'new' => 'danger',
                        'assigned', 'under_review' => 'warning',
                        'resolved' => 'success',
                        'escalated_scores' => 'gray',
                        default => 'secondary',
                    }),
                TextColumn::make('sla_due_at')
                    ->label('SLA Due')
                    ->dateTime('d M Y')
                    ->color(fn (Grievance $record): string => $record->isOverdue() ? 'danger' : 'gray'),
                TextColumn::make('assignedTo.name')
                    ->label('Grievance Officer')
                    ->placeholder('Unassigned'),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(Grievance::STATUSES),
                SelectFilter::make('category')
                    ->options(Grievance::CATEGORIES),
            ])
            ->actions([
                Action::make('assign')
                    ->label('Assign')
                    ->icon('heroicon-o-user-plus')
                    ->visible(fn (Grievance $record): bool => $record->status !== 'resolved' && (auth()->user()?->can('complaints.manage') ?? false))
                    ->form([
                        Select::make('officer_id')
                            ->label('Grievance Officer')
                            ->options(User::permission('complaints.manage')->pluck('name', 'id'))
                            ->required(),
                    ])
                    ->action(function (Grievance $record, array $data, GrievanceService $service): void {
                        $officer = User::findOrFail($data['officer_id']);
                        $service->assignGrievance($record, $officer);
                        Notification::make()->title('Grievance assigned')->success()->send();
                    }),

                Action::make('resolve')
                    ->label('Resolve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Grievance $record): bool => $record->status !== 'resolved' && (auth()->user()?->can('complaints.manage') ?? false))
                    ->form([
                        Textarea::make('resolution_notes')
                            ->label('Resolution Findings & Written Explanation')
                            ->required()
                            ->rows(4),
                    ])
                    ->action(function (Grievance $record, array $data, GrievanceService $service): void {
                        $service->resolveGrievance($record, $data['resolution_notes'], auth()->user());
                        Notification::make()->title('Grievance resolved and closed')->success()->send();
                    }),

                Action::make('escalate')
                    ->label('Escalate to SCORES')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->visible(fn (Grievance $record): bool => !$record->is_escalated_scores && (auth()->user()?->can('complaints.manage') ?? false))
                    ->form([
                        TextInput::make('scores_registration_number')
                            ->label('SEBI SCORES Registration / Case Reference')
                            ->nullable(),
                    ])
                    ->action(function (Grievance $record, array $data, GrievanceService $service): void {
                        $service->escalateToScores($record, $data['scores_registration_number'] ?? null);
                        Notification::make()->title('Grievance escalated to SEBI SCORES')->warning()->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageGrievances::route('/'),
        ];
    }
}
