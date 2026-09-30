<?php

namespace App\Domain\Billing\Gateways;

use App\Domain\Shared\ApiException;

/**
 * Resolves providers by key. Nothing is enabled until credentials are configured, so a half-set-up
 * gateway can never take a live payment.
 */
final class GatewayRegistry
{
    /** @var array<string, class-string<PaymentGateway>> */
    private const PROVIDERS = [
        'cashfree' => CashfreeGateway::class,
        'razorpay' => RazorpayGateway::class,
    ];

    public function get(string $key): PaymentGateway
    {
        $class = self::PROVIDERS[$key] ?? null;

        if ($class === null) {
            throw ApiException::unprocessable('UNKNOWN_PROVIDER', 'That payment provider is not supported.');
        }

        return app($class);
    }

    public function enabled(string $key): PaymentGateway
    {
        $gateway = $this->get($key);

        if (! $gateway->isEnabled()) {
            throw new ApiException('PROVIDER_DISABLED', 'That payment provider is not switched on.', 503);
        }

        return $gateway;
    }

    /**
     * @return list<PaymentGateway>
     */
    public function all(): array
    {
        return array_values(array_map(fn (string $class) => app($class), self::PROVIDERS));
    }

    /**
     * @return list<PaymentGateway>
     */
    public function enabledProviders(): array
    {
        return array_values(array_filter($this->all(), fn (PaymentGateway $gateway) => $gateway->isEnabled()));
    }
}
