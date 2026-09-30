<?php

namespace App\Filament\Resources\Leads\RelationManagers;

use App\Models\CallLog;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CallLogsRelationManager extends RelationManager
{
    protected static string $relationship = 'callLogs';

    protected static ?string $title = 'Calls';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedPhone;

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('called_at', 'desc')
            ->columns([
                TextColumn::make('called_at')->label('When')->dateTime('d M Y, h:i A', $tz)->sortable(),
                TextColumn::make('outcome')->badge()->formatStateUsing(fn (string $state) => CallLog::OUTCOMES[$state] ?? $state)
                    ->color(fn (string $state) => match ($state) {
                        'connected' => 'success',
                        'not_interested', 'wrong_number' => 'gray',
                        'callback_requested' => 'primary',
                        default => 'warning',
                    }),
                TextColumn::make('duration_seconds')->label('Duration')->formatStateUsing(fn (?int $state) => $state === null ? '—' : gmdate($state >= 3600 ? 'H:i:s' : 'i:s', $state)),
                TextColumn::make('employee.user.name')->label('By'),
                TextColumn::make('notes')->wrap()->limit(160)->placeholder('—'),
            ]);
    }
}
