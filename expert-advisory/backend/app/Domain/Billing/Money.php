<?php

namespace App\Domain\Billing;

use InvalidArgumentException;

/**
 * Amounts are integers in the smallest unit (paise). No float ever takes part in a calculation, so
 * totals are exact and identical on every machine. Rounding, where tax makes it unavoidable, is
 * half-up on the paise — stated explicitly rather than left to the platform.
 */
final readonly class Money
{
    private function __construct(public int $paise, public string $currency) {}

    public static function paise(int $paise, string $currency = 'INR'): self
    {
        return new self($paise, $currency);
    }

    public static function rupees(int|float|string $rupees, string $currency = 'INR'): self
    {
        if (is_string($rupees) && ! is_numeric($rupees)) {
            throw new InvalidArgumentException("[{$rupees}] is not a valid amount.");
        }

        return new self((int) self::roundHalfUp((float) $rupees * 100), $currency);
    }

    public static function zero(string $currency = 'INR'): self
    {
        return new self(0, $currency);
    }

    public function plus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->paise + $other->paise, $this->currency);
    }

    public function minus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->paise - $other->paise, $this->currency);
    }

    public function times(int $factor): self
    {
        return new self($this->paise * $factor, $this->currency);
    }

    /**
     * Applies a percentage, rounding half-up to the paise.
     */
    public function percentage(float $percent): self
    {
        return new self((int) self::roundHalfUp($this->paise * $percent / 100), $this->currency);
    }

    public function isZero(): bool
    {
        return $this->paise === 0;
    }

    public function isNegative(): bool
    {
        return $this->paise < 0;
    }

    public function greaterThan(self $other): bool
    {
        $this->assertSameCurrency($other);

        return $this->paise > $other->paise;
    }

    public function lessThan(self $other): bool
    {
        $this->assertSameCurrency($other);

        return $this->paise < $other->paise;
    }

    public function equals(self $other): bool
    {
        return $this->currency === $other->currency && $this->paise === $other->paise;
    }

    /**
     * Plain decimal string for storage in other systems and for PDFs, e.g. "11800.00".
     */
    public function toDecimal(): string
    {
        return number_format($this->paise / 100, 2, '.', '');
    }

    /**
     * Indian grouping, e.g. ₹1,23,456.00.
     */
    public function format(bool $withSymbol = true): string
    {
        $symbol = $withSymbol ? (string) config('billing.currency_symbol', '₹') : '';
        $negative = $this->paise < 0;
        $whole = (string) intdiv(abs($this->paise), 100);
        $fraction = str_pad((string) (abs($this->paise) % 100), 2, '0', STR_PAD_LEFT);

        if (strlen($whole) > 3) {
            $last3 = substr($whole, -3);
            $rest = substr($whole, 0, -3);
            $whole = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest).','.$last3;
        }

        return ($negative ? '-' : '').$symbol.$whole.'.'.$fraction;
    }

    private static function roundHalfUp(float $value): float
    {
        return floor(abs($value) + 0.5) * ($value < 0 ? -1 : 1);
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException("Cannot mix {$this->currency} and {$other->currency}.");
        }
    }
}
