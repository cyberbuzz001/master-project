<?php

namespace App\Filament\Resources\MarketDataSnapshots\Pages;

use App\Domain\MarketData\MarketDataSnapshotService;
use App\Filament\Resources\MarketDataSnapshots\MarketDataSnapshotResource;
use App\Filament\Support\DomainAction;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Pages\ListRecords;
use Filament\Support\Icons\Heroicon;

class ListMarketDataSnapshots extends ListRecords
{
    protected static string $resource = MarketDataSnapshotResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('capture_snapshot')
                ->label('Capture Quote Snapshot')
                ->icon(Heroicon::OutlinedCamera)
                ->form([
                    TextInput::make('symbol')
                        ->label('Symbol (e.g. RELIANCE, TCS, INFY)')
                        ->required()
                        ->autocapitalize(),
                    Select::make('exchange')
                        ->options(['NSE' => 'NSE', 'BSE' => 'BSE'])
                        ->default('NSE')
                        ->required(),
                ])
                ->action(function (array $data, Action $action) {
                    DomainAction::run(
                        $action,
                        fn () => app(MarketDataSnapshotService::class)->snapshotQuote($data['symbol'], $data['exchange']),
                        'Market data snapshot captured'
                    );
                }),
        ];
    }
}
