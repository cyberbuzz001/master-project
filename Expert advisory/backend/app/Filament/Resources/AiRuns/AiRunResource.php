<?php

namespace App\Filament\Resources\AiRuns;

use App\Filament\Resources\AiRuns\Pages\ManageAiRuns;
use App\Models\AiRun;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class AiRunResource extends Resource
{
    protected static ?string $model = AiRun::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCpuChip;

    protected static string|UnitEnum|null $navigationGroup = 'Platform';

    protected static ?int $navigationSort = 7;

    protected static ?string $navigationLabel = 'AI Audit & Usage';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('ai.usage.view') ?? false;
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
                TextColumn::make('created_at')
                    ->label('Executed')
                    ->dateTime('d M Y, H:i:s')
                    ->sortable(),
                TextColumn::make('agent')
                    ->searchable()
                    ->badge(),
                TextColumn::make('user.name')
                    ->label('User')
                    ->placeholder('System/Scheduled'),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'completed' => 'success',
                        'blocked_by_guardian' => 'danger',
                        'failed' => 'danger',
                        default => 'warning',
                    }),
                IconColumn::make('grounding_passed')
                    ->boolean()
                    ->label('Grounded'),
                TextColumn::make('input_tokens')
                    ->numeric(),
                TextColumn::make('output_tokens')
                    ->numeric(),
                TextColumn::make('estimated_cost_paise')
                    ->label('Cost')
                    ->formatStateUsing(fn ($state) => '₹' . number_format($state / 100, 2)),
                TextColumn::make('latency_ms')
                    ->label('Latency')
                    ->formatStateUsing(fn ($state) => $state . 'ms'),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'completed' => 'Completed',
                        'blocked_by_guardian' => 'Blocked by Guardian',
                        'failed' => 'Failed',
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageAiRuns::route('/'),
        ];
    }
}
