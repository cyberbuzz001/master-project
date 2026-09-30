<?php

namespace App\Filament\Resources\Leads\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class AssignmentsRelationManager extends RelationManager
{
    protected static string $relationship = 'assignments';

    protected static ?string $title = 'Ownership history';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedArrowPathRoundedSquare;

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('created_at')->label('When')->dateTime('d M Y, h:i A', config('platform.timezone_display')),
                TextColumn::make('fromEmployee.user.name')->label('From')->placeholder('Unassigned'),
                TextColumn::make('toEmployee.user.name')->label('To')->placeholder('Unassigned'),
                TextColumn::make('method')->badge()->color('gray'),
                TextColumn::make('assigner.name')->label('By')->placeholder('System'),
                TextColumn::make('reason')->wrap()->limit(120),
            ]);
    }
}
