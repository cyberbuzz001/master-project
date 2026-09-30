<?php

namespace App\Domain\Billing\Gateways;

use App\Domain\Shared\ApiException;
use App\Models\Invoice;
use Illuminate\Support\Facades\Http;

/**
 * Cashfree Payments. Credentials come from the environment and the provider stays off until they are
 * present, so a half-configured gateway can never take live money. Callback signatures are checked
 * against the raw body in constant time.
 */
final class CashfreeGateway implements PaymentGateway
{
    public function key(): string
    {
        return 'cashfree';
    }

    public function isEnabled(): bool
    {
        return (bool) config('billing.payments.providers.cashfree.enabled')
            && filled(config('services.cashfree.app_id'))
            && filled(config('services.cashfree.secret'));
    }

    public function createIntent(Invoice $invoice): array
    {
        $response = Http::withHeaders([
            'x-client-id' => (string) config('services.cashfree.app_id'),
            'x-client-secret' => (string) config('services.cashfree.secret'),
            'x-api-version' => (string) config('services.cashfree.api_version', '2023-08-01'),
        ])->post(rtrim((string) config('services.cashfree.base_url'), '/').'/orders', [
            'order_id' => $invoice->invoice_number,
            'order_amount' => (float) $invoice->balance()->toDecimal(),
            'order_currency' => $invoice->currency,
            'customer_details' => [
                'customer_id' => (string) $invoice->client_id,
                'customer_name' => $invoice->client_snapshot['name'] ?? 'Client',
                'customer_email' => $invoice->client_snapshot['email'] ?? null,
                'customer_phone' => $invoice->client_snapshot['mobile'] ?? null,
            ],
            'order_note' => 'Invoice '.$invoice->invoice_number,
        ]);

        if ($response->failed()) {
            throw new ApiException('GATEWAY_ERROR', 'The payment could not be started. Please try again shortly.', 502);
        }

        return [
            'reference' => (string) $response->json('order_id', $invoice->invoice_number),
            'redirect_url' => $response->json('payment_session_id') === null ? null : (string) $response->json('payment_link'),
            'payload' => ['payment_session_id' => $response->json('payment_session_id')],
        ];
    }

    public function verifySignature(string $rawBody, array $headers): bool
    {
        $timestamp = $this->header($headers, 'x-webhook-timestamp');
        $signature = $this->header($headers, 'x-webhook-signature');
        $secret = (string) config('services.cashfree.secret');

        if ($timestamp === null || $signature === null || $secret === '') {
            return false;
        }

        $expected = base64_encode(hash_hmac('sha256', $timestamp.$rawBody, $secret, true));

        return hash_equals($expected, $signature);
    }

    public function parseEvent(array $payload): array
    {
        $order = $payload['data']['order'] ?? [];
        $payment = $payload['data']['payment'] ?? [];

        return [
            'event_id' => (string) ($payment['cf_payment_id'] ?? $payload['event_time'] ?? ''),
            'event_type' => (string) ($payload['type'] ?? 'unknown'),
            'reference' => isset($payment['cf_payment_id']) ? (string) $payment['cf_payment_id'] : null,
            'status' => match ((string) ($payment['payment_status'] ?? '')) {
                'SUCCESS' => 'succeeded',
                'FAILED', 'USER_DROPPED' => 'failed',
                default => null,
            },
            'amount_paise' => isset($payment['payment_amount'])
                ? (int) round(((float) $payment['payment_amount']) * 100)
                : null,
            'invoice_number' => isset($order['order_id']) ? (string) $order['order_id'] : null,
        ];
    }

    /**
     * @param  array<string, list<string>|string>  $headers
     */
    private function header(array $headers, string $name): ?string
    {
        $value = $headers[$name] ?? $headers[strtolower($name)] ?? null;

        return is_array($value) ? ($value[0] ?? null) : $value;
    }
}
