<?php

namespace Tests\Feature;

use App\Domain\Research\Indicators\AverageTrueRange;
use App\Domain\Research\Indicators\BollingerBands;
use App\Domain\Research\Indicators\ExponentialMovingAverage;
use App\Domain\Research\Indicators\MovingAverageConvergenceDivergence;
use App\Domain\Research\Indicators\RelativeStrengthIndex;
use App\Domain\Research\Indicators\SimpleMovingAverage;
use App\Domain\Research\Indicators\Supertrend;
use Tests\TestCase;

class IndicatorTest extends TestCase
{
    public function test_sma_computes_expected_values(): void
    {
        $values = [10.0, 20.0, 30.0, 40.0, 50.0];
        $sma = SimpleMovingAverage::calculate($values, 3);

        $this->assertNull($sma[0]);
        $this->assertNull($sma[1]);
        $this->assertEquals(20.0, $sma[2]);
        $this->assertEquals(30.0, $sma[3]);
        $this->assertEquals(40.0, $sma[4]);
    }

    public function test_ema_computes_expected_values(): void
    {
        $values = [10.0, 11.0, 12.0, 13.0, 14.0];
        $ema = ExponentialMovingAverage::calculate($values, 3);

        $this->assertNull($ema[0]);
        $this->assertNull($ema[1]);
        $this->assertEquals(11.0, $ema[2]); // SMA seed
        // multiplier k = 2 / (3 + 1) = 0.5
        // EMA[3] = 13 * 0.5 + 11 * 0.5 = 12.0
        $this->assertEquals(12.0, $ema[3]);
        // EMA[4] = 14 * 0.5 + 12 * 0.5 = 13.0
        $this->assertEquals(13.0, $ema[4]);
    }

    public function test_rsi_computes_bounded_values(): void
    {
        $closes = [
            44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
            45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
        ];

        $rsi = RelativeStrengthIndex::calculate($closes, 14);

        $this->assertNull($rsi[0]);
        $this->assertNull($rsi[13]);
        $this->assertNotNull($rsi[14]);
        $this->assertGreaterThanOrEqual(0.0, $rsi[14]);
        $this->assertLessThanOrEqual(100.0, $rsi[14]);
    }

    public function test_macd_computes_structure(): void
    {
        $closes = array_map(fn ($i) => 100.0 + sin($i) * 10, range(1, 40));
        $macd = MovingAverageConvergenceDivergence::calculate($closes, 12, 26, 9);

        $this->assertCount(40, $macd);
        $last = end($macd);
        $this->assertArrayHasKey('macd', $last);
        $this->assertArrayHasKey('signal', $last);
        $this->assertArrayHasKey('histogram', $last);
        $this->assertNotNull($last['macd']);
        $this->assertNotNull($last['signal']);
        $this->assertNotNull($last['histogram']);
    }

    public function test_atr_and_bollinger_and_supertrend(): void
    {
        $highs = [105, 106, 107, 108, 107, 109, 110, 112, 111, 113, 114, 115, 116, 117, 118];
        $lows = [100, 101, 102, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113];
        $closes = [103, 104, 105, 106, 105, 108, 109, 110, 109, 112, 113, 114, 115, 116, 117];

        $atr = AverageTrueRange::calculate($highs, $lows, $closes, 10);
        $this->assertNotNull($atr[9]);
        $this->assertGreaterThan(0.0, $atr[9]);

        $bb = BollingerBands::calculate($closes, 10, 2.0);
        $this->assertNotNull($bb[9]['middle']);
        $this->assertGreaterThan($bb[9]['lower'], $bb[9]['upper']);

        $st = Supertrend::calculate($highs, $lows, $closes, 10, 3.0);
        $this->assertNotNull($st[9]['supertrend']);
        $this->assertContains($st[9]['direction'], [1, -1]);
    }
}
