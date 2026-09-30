<?php

namespace App\Filament\Resources\Teams;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\Teams\Pages\ManageTeams;
use App\Models\Employee;
use App\Models\Team;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class TeamResource extends Resource
{
    protected static ?string $model = Team::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUserGroup;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 2;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('leader.user:id,name')->withCount('employees');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(120)->unique(ignoreRecord: true),
            TextInput::make('description')->maxLength(255),
            Select::make('leader_employee_id')->label('Team leader')->searchable()
                ->options(fn () => Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()])),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('name')
            ->columns([
                TextColumn::make('name')->searchable()->weight('medium')->description(fn (Team $record) => $record->description),
                TextColumn::make('leader.user.name')->label('Leader')->placeholder('—'),
                TextColumn::make('employees_count')->label('Members')->numeric(),
                IconColumn::make('is_active')->boolean(),
            ])
            ->recordActions([
                EditAction::make()->after(fn (Team $record) => app(AuditLogger::class)->record('team.updated', $record, new: $record->getChanges())),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageTeams::route('/')];
    }
}
