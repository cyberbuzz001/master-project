<?php

namespace App\Domain\MarketData;

use App\Domain\MarketData\Providers\MockMarketDataProvider;
use InvalidArgumentException;

class MarketDataManager
{
    /**
     * @var array<string, MarketDataProviderInterface>
     */
    protected array $providers = [];

    public function __construct(protected ?string $defaultProvider = null)
    {
        $this->defaultProvider = $defaultProvider ?? config('market_data.default', 'mock');
    }

    public function provider(?string $name = null): MarketDataProviderInterface
    {
        $name = $name ?? $this->defaultProvider;

        if (! isset($this->providers[$name])) {
            $this->providers[$name] = $this->resolve($name);
        }

        return $this->providers[$name];
    }

    public function registerProvider(string $name, MarketDataProviderInterface $provider): void
    {
        $this->providers[$name] = $provider;
    }

    protected function resolve(string $name): MarketDataProviderInterface
    {
        return match ($name) {
            'mock' => new MockMarketDataProvider(),
            default => throw new InvalidArgumentException("Unsupported market data provider: [{$name}]"),
        };
    }
}
