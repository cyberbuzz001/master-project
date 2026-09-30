<?php

namespace App\Domain\MarketData;

use App\Domain\Shared\ApiException;
use App\Models\MarketDataSnapshot;
use Carbon\CarbonImmutable;

class MarketDataSnapshotService
{
    public function __construct(protected MarketDataManager $manager) {}

    /**
     * Take a fresh snapshot of a quote and store it.
     */
    public function snapshotQuote(string $symbol, string $exchange = 'NSE', ?string $provider = null): MarketDataSnapshot
    {
        $providerInstance = $this->manager->provider($provider);
        $quote = $providerInstance->fetchQuote($symbol, $exchange);

        $payload = $quote->toArray();
        $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $hash = hash('sha256', $json);

        return MarketDataSnapshot::create([
            'provider' => $providerInstance->code(),
            'dataset' => 'QUOTE',
            'symbol' => strtoupper($symbol),
            'exchange' => strtoupper($exchange),
            'payload_sha256' => $hash,
            'payload' => $payload,
            'as_of' => $quote->timestamp,
            'retrieved_at' => CarbonImmutable::now(),
            'is_stale' => false,
        ]);
    }

    /**
     * Take a snapshot of historical OHLCV data.
     */
    public function snapshotHistorical(string $symbol, string $exchange = 'NSE', string $timeframe = '1D', int $limit = 100, ?string $provider = null): MarketDataSnapshot
    {
        $providerInstance = $this->manager->provider($provider);
        $bars = $providerInstance->fetchHistorical($symbol, $exchange, $timeframe, $limit);

        $payload = array_map(fn ($b) => $b->toArray(), $bars);
        $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $hash = hash('sha256', $json);

        $latestBarTime = ! empty($bars) ? end($bars)->timestamp : CarbonImmutable::now();

        return MarketDataSnapshot::create([
            'provider' => $providerInstance->code(),
            'dataset' => "HISTORICAL_{$timeframe}",
            'symbol' => strtoupper($symbol),
            'exchange' => strtoupper($exchange),
            'payload_sha256' => $hash,
            'payload' => $payload,
            'as_of' => $latestBarTime,
            'retrieved_at' => CarbonImmutable::now(),
            'is_stale' => false,
        ]);
    }

    /**
     * Assert snapshot is not stale, or throw MARKET_DATA_STALE.
     */
    public function assertFresh(MarketDataSnapshot $snapshot, ?int $maxAgeSeconds = null): void
    {
        if ($snapshot->checkStale($maxAgeSeconds)) {
            throw ApiException::unprocessable(
                'MARKET_DATA_STALE',
                "Market data snapshot for {$snapshot->symbol} is stale (older than allowed threshold).",
                ['data_snapshot_id' => ["Data snapshot #{$snapshot->id} for {$snapshot->symbol} was taken on {$snapshot->as_of->toIso8601String()} and is stale."]]
            );
        }
    }
}
