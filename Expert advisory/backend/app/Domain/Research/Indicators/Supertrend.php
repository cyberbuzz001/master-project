<?php

namespace App\Domain\Research\Indicators;

final class Supertrend
{
    /**
     * Calculate Supertrend indicator.
     *
     * @param list<float> $highs
     * @param list<float> $lows
     * @param list<float> $closes
     * @return list<array{supertrend: float|null, direction: int|null}> 1 for Bullish, -1 for Bearish
     */
    public static function calculate(array $highs, array $lows, array $closes, int $period = 10, float $multiplier = 3.0): array
    {
        $atrs = AverageTrueRange::calculate($highs, $lows, $closes, $period);
        $count = count($closes);
        $result = [];

        $prevFinalUpper = null;
        $prevFinalLower = null;
        $prevSupertrend = null;
        $prevDirection = 1; // 1 for bull, -1 for bear

        for ($i = 0; $i < $count; $i++) {
            $atr = $atrs[$i];
            if ($atr === null) {
                $result[] = ['supertrend' => null, 'direction' => null];
                continue;
            }

            $h = (float) $highs[$i];
            $l = (float) $lows[$i];
            $c = (float) $closes[$i];
            $hl2 = ($h + $l) / 2.0;

            $basicUpper = $hl2 + ($multiplier * $atr);
            $basicLower = $hl2 - ($multiplier * $atr);

            // Final Upper Band
            if ($prevFinalUpper === null || $basicUpper < $prevFinalUpper || (isset($closes[$i - 1]) && (float) $closes[$i - 1] > $prevFinalUpper)) {
                $finalUpper = $basicUpper;
            } else {
                $finalUpper = $prevFinalUpper;
            }

            // Final Lower Band
            if ($prevFinalLower === null || $basicLower > $prevFinalLower || (isset($closes[$i - 1]) && (float) $closes[$i - 1] < $prevFinalLower)) {
                $finalLower = $basicLower;
            } else {
                $finalLower = $prevFinalLower;
            }

            // Trend direction
            if ($prevSupertrend === null) {
                $direction = ($c >= $finalUpper) ? 1 : -1;
                $supertrend = ($direction === 1) ? $finalLower : $finalUpper;
            } else {
                if ($prevSupertrend == $prevFinalUpper) {
                    $direction = ($c > $finalUpper) ? 1 : -1;
                } else {
                    $direction = ($c < $finalLower) ? -1 : 1;
                }
                $supertrend = ($direction === 1) ? $finalLower : $finalUpper;
            }

            $prevFinalUpper = $finalUpper;
            $prevFinalLower = $finalLower;
            $prevSupertrend = $supertrend;
            $prevDirection = $direction;

            $result[] = [
                'supertrend' => round($supertrend, 2),
                'direction' => $direction,
            ];
        }

        return $result;
    }
}
