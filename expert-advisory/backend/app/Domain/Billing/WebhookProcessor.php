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
 * Provider callbacks. Authenticated events are stored before they are acted on,
 * keyed by the provider's own event id, so replays cannot take effect twice.
 * Unsigned payloads are quarantined under a content-derived id and never move money.
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

        // Never let an unauthenticated payload reserve the provider's real
        // event ID. Store it under a content-derived quarantine ID instead.
        if (! $signatureValid) {
            $rejectedId = 'invalid-'.hash('sha256', $rawBody);
            $event = WebhookEvent::query()->firstOrCreate(
                ['provider' => $gateway->key(), 'event_id' => $rejectedId],
                [
                    'event_type' => $parsed['event_type'],
                    'payload' => $payload,
                    'signature_valid' => false,
                ],
            );
            if ($event->status === WebhookEvent::RECEIVED) {
                $this->close($event, WebhookEvent::FAILED, 'Signature did not match; nothing was applied.');
                $this->audit->record('webhook.rejected', $event, new: ['provider' => $gateway->key(), 'event_type' => $parsed['event_type']], actorType: 'system');
            }

            return ['status' => 'invalid_signature', 'event' => $event, 'duplicate' => $event->wasRecentlyCreated === false];
        }

        $eventId = $parsed['event_id'] !== '' ? $parsed['event_id'] : hash('sha256', $rawBody);
        $existing = WebhookEvent::query()->where(['provider' => $gateway->key(), 'event_id' => $eventId])->first();

        // Terminal outcomes are idempotent. A received event means a previous
        // worker died before completion, so it must be allowed to resume.
        if ($existing !== null && $existing->status !== WebhookEvent::RECEIVED) {
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

            if ($event->status !== WebhookEvent::RECEIVED) {
                return ['status' => 'duplicate', 'event' => $event, 'duplicate' => true];
            }
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

        if ($parsed['amount_paise'] !== null) {
            $amountPaise = (int) $parsed['amount_paise'];
            $outstandingPaise = $invoice->balance()->paise;
            if ($amountPaise <= 0 || $amountPaise > $outstandingPaise) {
                $this->close($event, WebhookEvent::FAILED, 'Gateway amount does not match the outstanding invoice balance.');
                $this->audit->record('webhook.rejected_amount', $event, new: [
                    'provider' => $gateway->key(),
                    'amount_paise' => $amountPaise,
                    'outstanding_paise' => $outstandingPaise,
                ], actorType: 'system');

                return ['status' => 'amount_mismatch', 'event' => $event, 'duplicate' => false];
            }
        }

        $result = DB::transaction(function () use ($gateway, $invoice, $parsed): string {
            $lockedInvoice = Invoice::query()
                ->withoutGlobalScopes()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            return $this->apply($gateway, $lockedInvoice, $parsed);
        });

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
        if ($amount <= 0 || $amount > $invoice->balance()->paise) {
            throw new \RuntimeException('Gateway amount exceeds the outstanding invoice balance.');
        }

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

        // A late failure callback must never downgrade a payment that was
        // already verified by an earlier successful provider event.
        if ($payment->isVerified()) {
            return 'Payment was already verified; nothing changed.';
        }

        if ($parsed['status'] === 'failed') {
            $payment->forceFill(['status' => Payment::FAILED, 'failure_reason' => 'The provider reported a failed payment.'])->save();
            $this->payments->event($payment, 'gateway_failed', 'The provider reported a failed payment.');

            return 'Payment marked as failed.';
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

            $client = $invoice->client;
            if ($client && $client->lead_id) {
                $lead = \App\Models\Lead::find($client->lead_id);
                if ($lead) {
                    $lead->update([
                        'status' => 'PAID',
                        'ai_conversation_state' => 'PAYMENT_VERIFIED',
                    ]);
                    app(\App\Domain\Crm\LeadScoringEngine::class)->scoreLead($lead);
                }
            }
        }

        return 'Payment verified and applied to '.$invoice->invoice_number.'.';
    }

    private function close(WebhookEvent $event, string $status, string $result): void
    {
        $event->forceFill(['status' => $status, 'result' => $result, 'processed_at' => now()])->save();
    }
}
