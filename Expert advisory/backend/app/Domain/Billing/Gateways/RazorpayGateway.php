<?php

namespace App\Domain\Billing\Gateways;

use App\Domain\Shared\ApiException;
use App\Models\Invoice;
use Illuminate\Support\Facades\Http;

/**
 * Razorpay. Same shape as the Cashfree adapter: off until credentials exist, signatures checked
 * against the raw body, and only the fields we act on are read out of a callback.
 */
final class RazorpayGateway implements PaymentGateway
{
    public function key(): string
    {
        return 'razorpay';
    }

    public function isEnabled(): bool
    {
        return (bool) config('billing.payments.providers.razorpay.enabled')
            && filled(config('services.razorpay.key_id'))
            && filled(config('services.razorpay.key_secret'));
    }

    public function createIntent(Invoice $invoice): array
    {
        $response = Http::withBasicAuth(
            (string) config('services.razorpay.key_id'),
            (string) config('services.razorpay.key_secret'),
        )->post(rtrim((string) config('services.razorpay.base_url'), '/').'/orders', [
            'amount' => $invoice->balance()->paise,
            'currency' => $invoice->currency,
            'receipt' => $invoice->invoice_number,
            'notes' => ['invoice_number' => $invoice->invoice_number, 'client_id' => (string) $invoice->client_id],
        ]);

        if ($response->failed()) {
            throw new ApiException('GATEWAY_ERROR', 'The payment could not be started. Please try again shortly.', 502);
        }

        return [
            'reference' => (string) $response->json('id'),
            'redirect_url' => null,
            'payload' => ['order_id' => $response->json('id'), 'key_id' => config('services.razorpay.key_id')],
        ];
    }

    public function verifySignature(string $rawBody, array $headers): bool
    {
        $signature = $headers['x-razorpay-signature'] ?? $headers['X-Razorpay-Signature'] ?? null;
        $signature = is_array($signature) ? ($signature[0] ?? null) : $signature;
        $secret = (string) config('services.razorpay.webhook_secret');

        if ($signature === null || $secret === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
    }

    public function parseEvent(array $payload): array
    {
        $payment = $payload['payload']['payment']['entity'] ?? [];

        return [
            'event_id' => (string) ($payload['id'] ?? $payment['id'] ?? ''),
            'event_type' => (string) ($payload['event'] ?? 'unknown'),
            'reference' => isset($payment['id']) ? (string) $payment['id'] : null,
            'status' => match ((string) ($payload['event'] ?? '')) {
                'payment.captured' => 'succeeded',
                'payment.failed' => 'failed',
                default => null,
            },
            'amount_paise' => isset($payment['amount']) ? (int) $payment['amount'] : null,
            'invoice_number' => $payment['notes']['invoice_number'] ?? null,
        ];
    }
}
