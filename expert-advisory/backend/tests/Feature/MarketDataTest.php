<?php

namespace Tests\Feature;

use App\Domain\MarketData\MarketDataManager;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\MarketData\Providers\MockMarketDataProvider;
use App\Domain\Shared\ApiException;
use App\Models\MarketDataSnapshot;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class MarketDataTest extends TestCase
{
    public function test_mock_provider_returns_quote_and_bars(): void
    {
        $provider = new MockMarketDataProvider();
        $quote = $provider->fetchQuote('RELIANCE');

        $this->assertSame('RELIANCE', $quote->symbol);
        $this->assertSame('NSE', $quote->exchange);
        $this->assertEquals(2950.0, $quote->ltp);
        $this->assertGreaterThan(0, $quote->volume);

        $bars = $provider->fetchHistorical('TCS', 'NSE', '1D', 20);
        $this->assertCount(20, $bars);
        $this->assertGreaterThan(0, $bars[0]->close);
    }

    public function test_snapshot_service_captures_and_hashes_quote(): void
    {
        $service = app(MarketDataSnapshotService::class);
        $snapshot = $service->snapshotQuote('INFY');

        $this->assertInstanceOf(MarketDataSnapshot::class, $snapshot);
        $this->assertSame('INFY', $snapshot->symbol);
        $this->assertSame('QUOTE', $snapshot->dataset);
        $this->assertNotEmpty($snapshot->payload_sha256);
        $this->assertFalse($snapshot->is_stale);

        // Verification of hash integrity
        $expectedHash = hash('sha256', json_encode($snapshot->payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        $this->assertSame($expectedHash, $snapshot->payload_sha256);
    }

    public function test_fresh_snapshot_passes_assertion(): void
    {
        $service = app(MarketDataSnapshotService::class);
        $snapshot = $service->snapshotQuote('HDFCBANK');

        // Should not throw
        $service->assertFresh($snapshot, 900);
        $this->assertTrue(true);
    }

    public function test_stale_snapshot_throws_market_data_stale(): void
    {
        $snapshot = MarketDataSnapshot::create([
            'provider' => 'mock',
            'dataset' => 'QUOTE',
            'symbol' => 'TATAMOTORS',
            'exchange' => 'NSE',
            'payload_sha256' => hash('sha256', '{}'),
            'payload' => ['symbol' => 'TATAMOTORS', 'ltp' => 980.0],
            'as_of' => CarbonImmutable::now()->subMinutes(30),
            'retrieved_at' => CarbonImmutable::now()->subMinutes(30),
            'is_stale' => false,
        ]);

        $service = app(MarketDataSnapshotService::class);

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('stale');

        $service->assertFresh($snapshot, 900); // 15 min threshold
    }
}
