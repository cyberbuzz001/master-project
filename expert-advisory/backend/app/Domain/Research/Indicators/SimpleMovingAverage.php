<?php

namespace App\Domain\Research\Indicators;

use InvalidArgumentException;

final class SimpleMovingAverage
{
    /**
     * Calculate Simple Moving Average over an array of floats.
     *
     * @param list<float> $values
     * @return list<float|null> Same length as $values, null where index < $period - 1
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

        $sum = 0.0;
        for ($i = 0; $i < $count; $i++) {
            $sum += (float) $values[$i];

            if ($i >= $period) {
                $sum -= (float) $values[$i - $period];
            }

            if ($i >= $period - 1) {
                $result[] = round($sum / $period, 4);
            } else {
                $result[] = null;
            }
        }

        return $result;
    }
}
