<?php

namespace App\Domain\MarketData\Providers;

use App\Domain\MarketData\DataTransferObjects\OhlcvBar;
use App\Domain\MarketData\DataTransferObjects\Quote;
use App\Domain\MarketData\MarketDataProviderInterface;
use Carbon\CarbonImmutable;

class MockMarketDataProvider implements MarketDataProviderInterface
{
    /**
     * Anchor prices for standard instruments.
     *
     * @var array<string, float>
     */
    private const BASE_PRICES = [
        'RELIANCE' => 2950.0,
        'TCS' => 4200.0,
        'INFY' => 1850.0,
        'HDFCBANK' => 1650.0,
        'ICICIBANK' => 1250.0,
        'TATAMOTORS' => 980.0,
        'SBIN' => 820.0,
        'NIFTY50' => 25200.0,
        'BANKNIFTY' => 52100.0,
    ];

    /**
     * Optional price overrides for unit tests.
     *
     * @var array<string, float>
     */
    protected static array $overrides = [];

    public static function setPriceOverride(string $symbol, float $price): void
    {
        self::$overrides[strtoupper($symbol)] = $price;
    }

    public static function clearOverrides(): void
    {
        self::$overrides = [];
    }

    public function code(): string
    {
        return 'mock';
    }

    public function fetchQuote(string $symbol, string $exchange = 'NSE'): Quote
    {
        $sym = strtoupper(trim($symbol));
        $base = self::$overrides[$sym] ?? self::BASE_PRICES[$sym] ?? 1000.0;

        $open = round($base * 0.995, 2);
        $high = round($base * 1.015, 2);
        $low = round($base * 0.990, 2);
        $close = round($base, 2);
        $prevClose = round($base * 0.992, 2);
        $change = round($close - $prevClose, 2);
        $changePct = round(($change / $prevClose) * 100, 2);

        return new Quote(
            symbol: $sym,
            exchange: strtoupper($exchange),
            ltp: $close,
            open: $open,
            high: $high,
            low: $low,
            close: $close,
            change: $change,
            changePercent: $changePct,
            volume: 1_250_000,
            timestamp: CarbonImmutable::now(),
            provider: $this->code(),
        );
    }

    public function fetchHistorical(string $symbol, string $exchange = 'NSE', string $timeframe = '1D', int $limit = 100): array
    {
        $sym = strtoupper(trim($symbol));
        $base = self::$overrides[$sym] ?? self::BASE_PRICES[$sym] ?? 1000.0;

        $bars = [];
        $now = CarbonImmutable::now();

        // Deterministic walk back in time
        $currentClose = $base;
        for ($i = $limit - 1; $i >= 0; $i--) {
            $date = $now->subDays($i);
            // Deterministic delta using hash
            $hashVal = hexdec(substr(md5($sym . $date->toDateString()), 0, 4)) % 1000;
            $pctFactor = ($hashVal - 490) / 10000; // -0.049 to +0.051
            $close = round($currentClose * (1 + $pctFactor), 2);
            $open = round($currentClose, 2);
            $high = round(max($open, $close) * 1.008, 2);
            $low = round(min($open, $close) * 0.992, 2);
            $volume = 500_000 + ($hashVal * 1000);

            $bars[] = new OhlcvBar(
                timestamp: $date,
                open: $open,
                high: $high,
                low: $low,
                close: $close,
                volume: $volume,
            );

            $currentClose = $close;
        }

        return $bars;
    }

    public function isHealthy(): bool
    {
        return true;
    }
}
