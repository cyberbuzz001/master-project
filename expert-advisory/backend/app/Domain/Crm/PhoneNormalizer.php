<?php

namespace App\Domain\Crm;

final class PhoneNormalizer
{
    /**
     * Normalizes Indian and international numbers to E.164. Returns null when the input is not a plausible number.
     */
    public static function toE164(?string $raw): ?string
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $hasPlus = str_starts_with(trim($raw), '+');
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (! $hasPlus) {
            $digits = ltrim($digits, '0');

            if (strlen($digits) === 10 && preg_match('/^[6-9]/', $digits) === 1) {
                return '+91'.$digits;
            }

            if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
                return '+'.$digits;
            }

            return null;
        }

        return strlen($digits) >= 8 && strlen($digits) <= 15 ? '+'.$digits : null;
    }
}
