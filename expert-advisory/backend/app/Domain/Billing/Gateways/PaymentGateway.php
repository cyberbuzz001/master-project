<?php

namespace App\Domain\Billing\Gateways;

use App\Models\Invoice;

/**
 * What every payment provider must offer. Deliberately small: we only need to start a payment, prove
 * a callback really came from the provider, and read the few fields we act on. Anything richer stays
 * provider-specific and out of the domain.
 */
interface PaymentGateway
{
    public function key(): string;

    public function isEnabled(): bool;

    /**
     * Starts a payment for an invoice and returns what the client needs to complete it.
     *
     * @return array{reference: string, redirect_url: ?string, payload: array<string, mixed>}
     */
    public function createIntent(Invoice $invoice): array;

    /**
     * Constant-time check that the raw body really came from the provider.
     */
    public function verifySignature(string $rawBody, array $headers): bool;

    /**
     * Normalises a callback into the handful of facts we act on.
     *
     * @param  array<string, mixed>  $payload
     * @return array{event_id: string, event_type: string, reference: ?string, status: ?string, amount_paise: ?int, invoice_number: ?string}
     */
    public function parseEvent(array $payload): array;
}
