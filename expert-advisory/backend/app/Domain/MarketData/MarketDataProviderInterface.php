<?php

namespace App\Domain\MarketData;

use App\Domain\MarketData\DataTransferObjects\OhlcvBar;
use App\Domain\MarketData\DataTransferObjects\Quote;

interface MarketDataProviderInterface
{
    /**
     * Provider unique code (e.g. 'mock', 'nse').
     */
    public function code(): string;

    /**
     * Fetch the latest quote for a given instrument symbol and exchange.
     */
    public function fetchQuote(string $symbol, string $exchange = 'NSE'): Quote;

    /**
     * Fetch historical OHLCV bars.
     *
     * @return list<OhlcvBar>
     */
    public function fetchHistorical(string $symbol, string $exchange = 'NSE', string $timeframe = '1D', int $limit = 100): array;

    /**
     * Check if provider is available and responding.
     */
    public function isHealthy(): bool;
}
