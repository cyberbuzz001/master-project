<?php

namespace App\Domain\MarketData\DataTransferObjects;

use DateTimeInterface;

final class Quote
{
    public function __construct(
        public readonly string $symbol,
        public readonly string $exchange,
        public readonly float $ltp,
        public readonly float $open,
        public readonly float $high,
        public readonly float $low,
        public readonly float $close,
        public readonly float $change,
        public readonly float $changePercent,
        public readonly int $volume,
        public readonly DateTimeInterface $timestamp,
        public readonly string $provider,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'symbol' => $this->symbol,
            'exchange' => $this->exchange,
            'ltp' => $this->ltp,
            'open' => $this->open,
            'high' => $this->high,
            'low' => $this->low,
            'close' => $this->close,
            'change' => $this->change,
            'change_percent' => $this->changePercent,
            'volume' => $this->volume,
            'timestamp' => $this->timestamp->format(DateTimeInterface::ATOM),
            'provider' => $this->provider,
        ];
    }
}
