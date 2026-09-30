<?php

namespace App\Domain\Research\Indicators;

use InvalidArgumentException;

final class AverageTrueRange
{
    /**
     * Calculate Average True Range (ATR) given arrays of highs, lows, and closes.
     *
     * @param list<float> $highs
     * @param list<float> $lows
     * @param list<float> $closes
     * @return list<float|null>
     */
    public static function calculate(array $highs, array $lows, array $closes, int $period = 14): array
    {
        if ($period <= 0) {
            throw new InvalidArgumentException('Period must be greater than zero.');
        }

        $count = count($closes);
        if ($count < $period || count($highs) !== $count || count($lows) !== $count) {
            return array_fill(0, $count, null);
        }

        $trueRanges = [];
        $trueRanges[] = (float) $highs[0] - (float) $lows[0];

        for ($i = 1; $i < $count; $i++) {
            $h = (float) $highs[$i];
            $l = (float) $lows[$i];
            $prevC = (float) $closes[$i - 1];

            $tr = max($h - $l, abs($h - $prevC), abs($l - $prevC));
            $trueRanges[] = $tr;
        }

        $result = [];
        $sumTr = 0.0;

        for ($i = 0; $i < $count; $i++) {
            if ($i < $period - 1) {
                $sumTr += $trueRanges[$i];
                $result[] = null;
            } elseif ($i === $period - 1) {
                $sumTr += $trueRanges[$i];
                $prevAtr = $sumTr / $period;
                $result[] = round($prevAtr, 4);
            } else {
                $atr = (($prevAtr * ($period - 1)) + $trueRanges[$i]) / $period;
                $prevAtr = $atr;
                $result[] = round($atr, 4);
            }
        }

        return $result;
    }
}
