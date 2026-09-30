<?php

namespace App\Domain\Research\Indicators;

use InvalidArgumentException;

final class RelativeStrengthIndex
{
    /**
     * Calculate Relative Strength Index (Wilder's RSI) over closing prices.
     *
     * @param list<float> $closes
     * @param int $period Default 14
     * @return list<float|null>
     */
    public static function calculate(array $closes, int $period = 14): array
    {
        if ($period <= 0) {
            throw new InvalidArgumentException('Period must be greater than zero.');
        }

        $count = count($closes);
        $result = [];

        if ($count <= $period) {
            return array_fill(0, $count, null);
        }

        $gains = [];
        $losses = [];

        for ($i = 1; $i < $count; $i++) {
            $change = (float) $closes[$i] - (float) $closes[$i - 1];
            $gains[] = $change > 0 ? $change : 0.0;
            $losses[] = $change < 0 ? abs($change) : 0.0;
        }

        $result[] = null; // index 0 has no change

        $avgGain = 0.0;
        $avgLoss = 0.0;

        for ($i = 0; $i < $period; $i++) {
            $avgGain += $gains[$i];
            $avgLoss += $losses[$i];
            if ($i < $period - 1) {
                $result[] = null;
            }
        }

        $avgGain /= $period;
        $avgLoss /= $period;

        if ($avgLoss == 0.0) {
            $result[] = 100.0;
        } else {
            $rs = $avgGain / $avgLoss;
            $result[] = round(100.0 - (100.0 / (1.0 + $rs)), 2);
        }

        // Smoothed Wilder iterations
        for ($i = $period; $i < count($gains); $i++) {
            $avgGain = (($avgGain * ($period - 1)) + $gains[$i]) / $period;
            $avgLoss = (($avgLoss * ($period - 1)) + $losses[$i]) / $period;

            if ($avgLoss == 0.0) {
                $result[] = 100.0;
            } else {
                $rs = $avgGain / $avgLoss;
                $result[] = round(100.0 - (100.0 / (1.0 + $rs)), 2);
            }
        }

        return $result;
    }
}
