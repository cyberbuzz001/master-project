<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Market Data Provider
    |--------------------------------------------------------------------------
    |
    | Supported: "mock", "nse", "alphavantage"
    |
    */
    'default' => env('MARKET_DATA_PROVIDER', 'mock'),

    /*
    |--------------------------------------------------------------------------
    | Staleness Thresholds
    |--------------------------------------------------------------------------
    |
    | Maximum age (in seconds) before market data snapshot is deemed stale.
    | Intraday/quote default: 15 minutes (900s). End-of-day: 24 hours (86400s).
    |
    */
    'stale_threshold_seconds' => (int) env('MARKET_DATA_STALE_SECONDS', 900),

    'providers' => [
        'mock' => [
            'class' => \App\Domain\MarketData\Providers\MockMarketDataProvider::class,
        ],
        'nse' => [
            'base_url' => env('NSE_BASE_URL', 'https://www.nseindia.com'),
            'timeout' => 5,
        ],
    ],
];
