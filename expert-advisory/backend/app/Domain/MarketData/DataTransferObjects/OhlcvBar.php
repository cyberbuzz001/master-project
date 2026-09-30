<?php

namespace App\Domain\MarketData\DataTransferObjects;

use DateTimeInterface;

final class OhlcvBar
{
    public function __construct(
        public readonly DateTimeInterface $timestamp,
        public readonly float $open,
        public readonly float $high,
        public readonly float $low,
        public readonly float $close,
        public readonly int $volume,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'timestamp' => $this->timestamp->format(DateTimeInterface::ATOM),
            'open' => $this->open,
            'high' => $this->high,
            'low' => $this->low,
            'close' => $this->close,
            'volume' => $this->volume,
        ];
    }
}
