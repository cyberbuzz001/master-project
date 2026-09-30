<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Money in. A payment recorded by hand counts for nothing until a second person verifies it, and
 * only a verified payment moves an invoice or starts a service. Every state change leaves an event.
 */
final class PaymentService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly InvoiceService $invoices,
        private readonly SubscriptionService $subscriptions,
        private readonly BillingDocumentService $documents,
    ) {}

    /**
     * Records a payment the client says they have made. It lands as pending verification.
     */
    public function record(User $actor, Client $client, array $data): Payment
    {
        if (! $actor->can('payments.view')) {
            throw ApiException::forbidden('You are not allowed to record payments.');
        }

        $method = $data['method'] ?? null;

        if (! in_array($method, config('billing.payments.manual_methods'), true)) {
            throw ApiException::unprocessable('UNSUPPORTED_METHOD', 'That payment method cannot be recorded by hand.');
        }

        $amount = Money::paise((int) ($data['amount_paise'] ?? 0));

        if ($amount->paise <= 0) {
            throw ApiException::unprocessable('INVALID_AMOUNT', 'Enter the amount actually received.');
        }

        $invoice = isset($data['invoice_id']) ? Invoice::query()->findOrFail($data['invoice_id']) : null;

        if ($invoice !== null && $invoice->client_id !== $client->id) {
            throw ApiException::unprocessable('INVOICE_MISMATCH', 'That invoice belongs to another client.');
        }

        if ($invoice !== null && ! $invoice->isOpen()) {
            throw ApiException::unprocessable('INVOICE_NOT_OPEN', 'That invoice is not open for payment.');
        }

        $proof = isset($data['proof_document_id']) ? Document::query()->find($data['proof_document_id']) : null;

        if (config('billing.payments.require_proof_for_manual') && $proof === null && $method !== 'cash') {
            throw ApiException::unprocessable('PROOF_REQUIRED', 'Attach the payment proof (screenshot, UTR slip or bank advice).');
        }

        return DB::transaction(function () use ($actor, $client, $invoice, $amount, $method, $data, $proof): Payment {
            $payment = new Payment([
                'client_id' => $client->id,
                'invoice_id' => $invoice?->id,
                'amount_paise' => $amount->paise,
                'method' => $method,
                'reference' => $data['reference'] ?? null,
                'received_at' => $data['received_at'] ?? now(),
                'proof_document_id' => $proof?->id,
                'is_demo' => (bool) $client->is_demo,
            ]);
            $payment->forceFill(['provider' => 'manual', 'recorded_by' => $actor->id, 'status' => Payment::PENDING_VERIFICATION])->save();

            $this->event($payment, 'recorded', $actor->name.' recorded '.$amount->format().' by '.$payment->methodLabel(), $actor);
            $this->audit->record('payment.recorded', $payment, new: [
                'amount_paise' => $amount->paise, 'method' => $method, 'invoice_id' => $invoice?->id,
            ], actor: $actor);

            return $payment;
        });
    }

    /**
     * Verification is the moment money becomes real for the rest of the system.
     */
    public function verify(User $actor, Payment $payment, ?string $note = null): Payment
    {
        if (! $actor->can('payments.verify_manual')) {
            throw ApiException::forbidden('You are not allowed to verify payments.');
        }

        if ($payment->status === Payment::SUCCEEDED) {
            throw ApiException::unprocessable('ALREADY_VERIFIED', 'This payment is already verified.');
        }

        if ($payment->status === Payment::REFUNDED) {
            throw ApiException::unprocessable('REFUNDED', 'A refunded payment cannot be verified.');
        }

        if (config('billing.payments.require_separate_verifier')
            && $payment->recorded_by !== null
            && $payment->recorded_by === $actor->id) {
            throw ApiException::forbidden('A payment must be verified by someone other than the person who recorded it.', 'SEPARATION_OF_DUTIES');
        }

        return DB::transaction(function () use ($actor, $payment, $note): Payment {
            $payment->forceFill([
                'status' => Payment::SUCCEEDED,
                'verified_by' => $actor->id,
                'verified_at' => now(),
                'failure_reason' => null,
            ])->save();

            $this->event($payment, 'verified', $actor->name.' verified the payment'.($note === null ? '' : ': '.$note), $actor);
            $this->audit->record('payment.verified', $payment, new: ['status' => Payment::SUCCEEDED], reason: $note, actor: $actor);

            $this->settle($payment, $actor);
            $this->documents->receiptFor($payment->refresh(), $actor);

            return $payment->refresh();
        });
    }

    public function reject(User $actor, Payment $payment, string $reason): Payment
    {
        if (! $actor->can('payments.verify_manual')) {
            throw ApiException::forbidden('You are not allowed to verify payments.');
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Say why the payment could not be confirmed.');
        }

        if ($payment->status === Payment::SUCCEEDED) {
            throw ApiException::unprocessable('ALREADY_VERIFIED', 'Verified payments are reversed with a refund, not a rejection.');
        }

        $payment->forceFill([
            'status' => Payment::FAILED,
            'failure_reason' => $reason,
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ])->save();

        $this->event($payment, 'rejected', 'Payment could not be confirmed: '.$reason, $actor);
        $this->audit->record('payment.rejected', $payment, new: ['status' => Payment::FAILED], reason: $reason, actor: $actor);

        return $payment;
    }

    /**
     * Records a refund against a verified payment and rolls back what it activated.
     */
    public function refund(User $actor, Payment $payment, string $reason): Payment
    {
        if (! $actor->can('payments.refund')) {
            throw ApiException::forbidden('You are not allowed to approve refunds.');
        }

        if ($payment->status !== Payment::SUCCEEDED) {
            throw ApiException::invalidTransition($payment->status, Payment::REFUNDED);
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give the reason for the refund.');
        }

        return DB::transaction(function () use ($actor, $payment, $reason): Payment {
            $payment->forceFill(['status' => Payment::REFUNDED])->save();

            $this->event($payment, 'refunded', 'Refunded: '.$reason, $actor);
            $this->audit->record('payment.refunded', $payment, new: ['status' => Payment::REFUNDED], reason: $reason, actor: $actor);

            if ($payment->invoice !== null) {
                $this->invoices->refreshPaymentState($payment->invoice->fresh());
            }

            $this->subscriptions->revokeForUnpaidInvoice($payment->invoice?->fresh(), $actor, 'Payment refunded: '.$reason);

            return $payment->refresh();
        });
    }

    /**
     * Applies a verified payment: updates the invoice and activates anything it has paid for.
     */
    public function settle(Payment $payment, ?User $actor = null): void
    {
        if (! $payment->isVerified() || $payment->invoice === null) {
            return;
        }

        $invoice = $this->invoices->refreshPaymentState($payment->invoice->fresh());

        if ($invoice->isSettled()) {
            $this->subscriptions->activateForInvoice($invoice, $actor);
        }
    }

    public function event(Payment $payment, string $type, string $summary, ?User $actor = null, array $payload = []): PaymentEvent
    {
        return PaymentEvent::create([
            'payment_id' => $payment->id,
            'type' => $type,
            'summary' => $summary,
            'payload' => $payload === [] ? null : $payload,
            'actor_user_id' => $actor?->id,
            'occurred_at' => now(),
        ]);
    }
}
