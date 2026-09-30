<?php

namespace App\Filament\Resources\MarketDataSnapshots;

use App\Domain\MarketData\MarketDataSnapshotService;
use App\Filament\Resources\MarketDataSnapshots\Pages\ListMarketDataSnapshots;
use App\Filament\Support\DomainAction;
use App\Models\MarketDataSnapshot;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class MarketDataSnapshotResource extends Resource
{
    protected static ?string $model = MarketDataSnapshot::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCircleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Research Desk';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'symbol';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('market_data.view');
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('symbol')->weight('bold')->searchable(),
                TextColumn::make('exchange')->badge()->color('gray'),
                TextColumn::make('dataset')->badge(),
                TextColumn::make('provider')->badge()->color('info'),
                TextColumn::make('payload.ltp')->label('LTP')->numeric(decimalPlaces: 2)->alignRight(),
                TextColumn::make('as_of')->label('As Of')->dateTime('d M Y H:i:s')->sortable(),
                IconColumn::make('is_stale')->label('Stale')->boolean(),
                TextColumn::make('payload_sha256')->label('SHA-256')->fontFamily('mono')->limit(16)->copyable(),
            ])
            ->filters([
                SelectFilter::make('provider')->options(['mock' => 'Mock', 'nse' => 'NSE']),
                SelectFilter::make('dataset')->options(['QUOTE' => 'Quote', 'HISTORICAL_1D' => 'Historical 1D']),
            ])
            ->actions([
                ViewAction::make(),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Snapshot Metadata')
                    ->schema([
                        Grid::make(4)->schema([
                            TextEntry::make('symbol')->weight('bold'),
                            TextEntry::make('exchange'),
                            TextEntry::make('dataset'),
                            TextEntry::make('provider'),
                        ]),
                        Grid::make(3)->schema([
                            TextEntry::make('as_of')->dateTime('d M Y H:i:s'),
                            TextEntry::make('retrieved_at')->dateTime('d M Y H:i:s'),
                            TextEntry::make('is_stale')->badge()->color(fn ($state) => $state ? 'danger' : 'success')
                                ->formatStateUsing(fn ($state) => $state ? 'Stale' : 'Fresh'),
                        ]),
                        TextEntry::make('payload_sha256')->label('Payload SHA-256 Hash')->fontFamily('mono')->columnSpanFull(),
                    ]),
                Section::make('Payload')
                    ->schema([
                        KeyValueEntry::make('payload')->columnSpanFull(),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListMarketDataSnapshots::route('/'),
        ];
    }
}
