<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Billing\Gateways\PaymentGateway;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\WebhookEvent;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Provider callbacks. Every event is stored before it is acted on, keyed by the provider's own event
 * id, so a replay (providers retry) can never take effect twice. An unsigned or unknown event is
 * kept for inspection and ignored — it never moves money.
 */
final class WebhookProcessor
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly PaymentService $payments,
        private readonly InvoiceService $invoices,
        private readonly SubscriptionService $subscriptions,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array{status: string, event: WebhookEvent, duplicate: bool}
     */
    public function handle(PaymentGateway $gateway, string $rawBody, array $headers, array $payload): array
    {
        $signatureValid = $gateway->verifySignature($rawBody, $headers);
        $parsed = $gateway->parseEvent($payload);
        $eventId = $parsed['event_id'] !== '' ? $parsed['event_id'] : hash('sha256', $rawBody);

        $existing = WebhookEvent::query()->where(['provider' => $gateway->key(), 'event_id' => $eventId])->first();

        if ($existing !== null) {
            return ['status' => 'duplicate', 'event' => $existing, 'duplicate' => true];
        }

        try {
            $event = WebhookEvent::create([
                'provider' => $gateway->key(),
                'event_id' => $eventId,
                'event_type' => $parsed['event_type'],
                'payload' => $payload,
                'signature_valid' => $signatureValid,
            ]);
        } catch (QueryException) {
            // Two copies of the same callback arrived at once; the first one wins.
            $event = WebhookEvent::query()->where(['provider' => $gateway->key(), 'event_id' => $eventId])->firstOrFail();

            return ['status' => 'duplicate', 'event' => $event, 'duplicate' => true];
        }

        if (! $signatureValid) {
            $this->close($event, WebhookEvent::FAILED, 'Signature did not match; nothing was applied.');
            $this->audit->record('webhook.rejected', $event, new: ['provider' => $gateway->key(), 'event_type' => $parsed['event_type']], actorType: 'system');

            return ['status' => 'invalid_signature', 'event' => $event, 'duplicate' => false];
        }

        if ($parsed['status'] === null) {
            $this->close($event, WebhookEvent::IGNORED, 'Event type carries no payment outcome we act on.');

            return ['status' => 'ignored', 'event' => $event, 'duplicate' => false];
        }

        $invoice = $parsed['invoice_number'] === null
            ? null
            : Invoice::query()->withoutGlobalScopes()->where('invoice_number', $parsed['invoice_number'])->first();

        if ($invoice === null) {
            $this->close($event, WebhookEvent::FAILED, 'No invoice matches '.($parsed['invoice_number'] ?? 'the callback').'.');

            return ['status' => 'unmatched', 'event' => $event, 'duplicate' => false];
        }

        $result = DB::transaction(fn () => $this->apply($gateway, $invoice, $parsed));

        $this->close($event, WebhookEvent::PROCESSED, $result);

        return ['status' => 'processed', 'event' => $event->refresh(), 'duplicate' => false];
    }

    /**
     * @param  array{reference: ?string, status: ?string, amount_paise: ?int}  $parsed
     */
    private function apply(PaymentGateway $gateway, Invoice $invoice, array $parsed): string
    {
        $payment = Payment::query()
            ->where(['provider' => $gateway->key(), 'provider_reference' => $parsed['reference']])
            ->first();

        $amount = $parsed['amount_paise'] ?? $invoice->balance()->paise;

        if ($payment === null) {
            $payment = new Payment([
                'client_id' => $invoice->client_id,
                'invoice_id' => $invoice->id,
                'amount_paise' => $amount,
                'method' => 'gateway',
                'is_demo' => (bool) $invoice->is_demo,
            ]);
            $payment->forceFill([
                'provider' => $gateway->key(),
                'provider_reference' => $parsed['reference'],
                'status' => Payment::INITIATED,
                'received_at' => now(),
            ])->save();
        }

        if ($parsed['status'] === 'failed') {
            $payment->forceFill(['status' => Payment::FAILED, 'failure_reason' => 'The provider reported a failed payment.'])->save();
            $this->payments->event($payment, 'gateway_failed', 'The provider reported a failed payment.');

            return 'Payment marked as failed.';
        }

        if ($payment->isVerified()) {
            return 'Payment was already verified; nothing changed.';
        }

        // The provider is the verifier for a gateway payment, so no second person is required —
        // but it still goes through the same settlement path as a manual payment.
        $payment->forceFill([
            'status' => Payment::SUCCEEDED,
            'verified_at' => now(),
            'received_at' => $payment->received_at ?? now(),
        ])->save();

        $this->payments->event($payment, 'gateway_verified', 'Confirmed by '.$gateway->key().'.', null, ['reference' => $parsed['reference']]);
        $this->audit->record('payment.verified', $payment, new: ['status' => Payment::SUCCEEDED, 'provider' => $gateway->key()], actorType: 'system');

        $this->invoices->refreshPaymentState($invoice->fresh());

        if ($invoice->fresh()->isSettled()) {
            $this->subscriptions->activateForInvoice($invoice->fresh());
        }

        return 'Payment verified and applied to '.$invoice->invoice_number.'.';
    }

    private function close(WebhookEvent $event, string $status, string $result): void
    {
        $event->forceFill(['status' => $status, 'result' => $result, 'processed_at' => now()])->save();
    }
}
