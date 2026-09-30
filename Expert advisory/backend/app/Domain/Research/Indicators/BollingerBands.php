<?php

namespace App\Domain\Research\Indicators;

use InvalidArgumentException;

final class BollingerBands
{
    /**
     * Calculate Bollinger Bands over closing prices.
     *
     * @param list<float> $closes
     * @return list<array{middle: float|null, upper: float|null, lower: float|null}>
     */
    public static function calculate(array $closes, int $period = 20, float $multiplier = 2.0): array
    {
        if ($period <= 0) {
            throw new InvalidArgumentException('Period must be greater than zero.');
        }

        $count = count($closes);
        $smas = SimpleMovingAverage::calculate($closes, $period);
        $result = [];

        for ($i = 0; $i < $count; $i++) {
            if ($smas[$i] === null) {
                $result[] = ['middle' => null, 'upper' => null, 'lower' => null];
                continue;
            }

            $mean = $smas[$i];
            $sumSq = 0.0;
            for ($k = $i - $period + 1; $k <= $i; $k++) {
                $diff = (float) $closes[$k] - $mean;
                $sumSq += $diff * $diff;
            }

            $stdDev = sqrt($sumSq / $period);
            $upper = round($mean + ($multiplier * $stdDev), 4);
            $lower = round($mean - ($multiplier * $stdDev), 4);

            $result[] = [
                'middle' => $mean,
                'upper' => $upper,
                'lower' => $lower,
            ];
        }

        return $result;
    }
}
