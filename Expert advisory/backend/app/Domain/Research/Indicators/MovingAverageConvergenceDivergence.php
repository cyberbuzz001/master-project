<?php

namespace App\Domain\Research\Indicators;

final class MovingAverageConvergenceDivergence
{
    /**
     * Calculate MACD (MACD line, Signal line, Histogram).
     *
     * @param list<float> $closes
     * @return list<array{macd: float|null, signal: float|null, histogram: float|null}>
     */
    public static function calculate(array $closes, int $fast = 12, int $slow = 26, int $signal = 9): array
    {
        $fastEma = ExponentialMovingAverage::calculate($closes, $fast);
        $slowEma = ExponentialMovingAverage::calculate($closes, $slow);

        $count = count($closes);
        $macdLine = [];

        for ($i = 0; $i < $count; $i++) {
            if ($fastEma[$i] !== null && $slowEma[$i] !== null) {
                $macdLine[] = round($fastEma[$i] - $slowEma[$i], 4);
            } else {
                $macdLine[] = null;
            }
        }

        // Calculate Signal line as EMA of MACD line (filtering valid values)
        $validMacd = [];
        $validIndices = [];
        foreach ($macdLine as $idx => $val) {
            if ($val !== null) {
                $validMacd[] = $val;
                $validIndices[] = $idx;
            }
        }

        $signalLineCalculated = ExponentialMovingAverage::calculate($validMacd, $signal);
        $signalMap = [];
        foreach ($validIndices as $pos => $origIdx) {
            $signalMap[$origIdx] = $signalLineCalculated[$pos];
        }

        $result = [];
        for ($i = 0; $i < $count; $i++) {
            $m = $macdLine[$i] ?? null;
            $s = $signalMap[$i] ?? null;
            $h = ($m !== null && $s !== null) ? round($m - $s, 4) : null;

            $result[] = [
                'macd' => $m,
                'signal' => $s,
                'histogram' => $h,
            ];
        }

        return $result;
    }
}
