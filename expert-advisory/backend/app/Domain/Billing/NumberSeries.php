<?php

namespace App\Domain\Billing;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Gap-free numbering per series and financial year. The counter row is locked for the duration of
 * the transaction, so two people issuing at the same moment cannot take the same number.
 */
final class NumberSeries
{
    public static function next(string $series, ?Carbon $date = null): string
    {
        $date ??= now();
        $period = self::financialYear($date);
        $config = config("billing.numbering.{$series}", ['prefix' => strtoupper($series), 'pad' => 5]);

        $value = DB::transaction(function () use ($series, $period): int {
            $row = DB::table('number_series')->where(['series' => $series, 'period' => $period])->lockForUpdate()->first();

            if ($row === null) {
                DB::table('number_series')->insert([
                    'series' => $series, 'period' => $period, 'next_value' => 2,
                    'created_at' => now(), 'updated_at' => now(),
                ]);

                return 1;
            }

            DB::table('number_series')->where('id', $row->id)->update(['next_value' => $row->next_value + 1, 'updated_at' => now()]);

            return (int) $row->next_value;
        });

        return sprintf('%s/%s/%s', $config['prefix'], $period, str_pad((string) $value, $config['pad'], '0', STR_PAD_LEFT));
    }

    /**
     * "2026-27" for a financial year starting in April.
     */
    public static function financialYear(Carbon $date): string
    {
        $startMonth = (int) config('billing.financial_year_start.month', 4);
        $start = $date->month >= $startMonth ? $date->year : $date->year - 1;

        return $startMonth === 1 ? (string) $start : $start.'-'.substr((string) ($start + 1), -2);
    }
}
