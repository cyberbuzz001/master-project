<?php

namespace App\Domain\Research\Indicators;

use InvalidArgumentException;

final class ExponentialMovingAverage
{
    /**
     * Calculate Exponential Moving Average over an array of floats.
     * Initial seed is the SMA of the first $period elements.
     * Multiplier = 2 / ($period + 1).
     *
     * @param list<float> $values
     * @return list<float|null>
     */
    public static function calculate(array $values, int $period): array
    {
        if ($period <= 0) {
            throw new InvalidArgumentException('Period must be greater than zero.');
        }

        $count = count($values);
        $result = [];

        if ($count < $period) {
            return array_fill(0, $count, null);
        }

        $k = 2.0 / ($period + 1.0);
        $smaSum = 0.0;
        $prevEma = null;

        for ($i = 0; $i < $count; $i++) {
            $val = (float) $values[$i];

            if ($i < $period - 1) {
                $smaSum += $val;
                $result[] = null;
            } elseif ($i === $period - 1) {
                $smaSum += $val;
                $prevEma = $smaSum / $period;
                $result[] = round($prevEma, 4);
            } else {
                $ema = ($val * $k) + ($prevEma * (1.0 - $k));
                $prevEma = $ema;
                $result[] = round($ema, 4);
            }
        }

        return $result;
    }
}
