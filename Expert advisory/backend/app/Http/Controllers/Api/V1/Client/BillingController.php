<?php

namespace App\Http\Controllers\Api\V1\Client;

use App\Domain\Billing\BillingDocumentService;
use App\Domain\Billing\Gateways\GatewayRegistry;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What a client can see about their own money: services, invoices and payments. Read-only — no
 * payment can be created or confirmed from here; that happens in the back-office or, from Phase 4b,
 * through a gateway callback.
 */
final class BillingController extends Controller
{
    public function __construct(
        private readonly DocumentVault $vault,
        private readonly BillingDocumentService $documents,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $client = $this->client($request);

        $subscriptions = Subscription::query()
            ->where('client_id', $client->id)
            ->with('planVersion.plan.service')
            ->latest('id')
            ->get();

        $invoices = Invoice::query()
            ->where('client_id', $client->id)
            ->where('status', '!=', Invoice::DRAFT)
            ->latest('id')
            ->get();

        $payments = Payment::query()
            ->where('client_id', $client->id)
            ->with('invoice:id,invoice_number')
            ->latest('id')
            ->get();

        $receipts = Receipt::query()->whereIn('payment_id', $payments->pluck('id'))->get()->keyBy('payment_id');

        return ApiResponse::success([
            'subscriptions' => $subscriptions->map(fn (Subscription $subscription) => [
                'uuid' => $subscription->uuid,
                'service' => $subscription->planVersion?->plan?->service?->name,
                'plan' => $subscription->planVersion?->plan?->name,
                'status' => $subscription->status,
                'starts_on' => $subscription->starts_on?->toDateString(),
                'ends_on' => $subscription->ends_on?->toDateString(),
                'days_remaining' => $subscription->isRunning() ? $subscription->daysRemaining() : null,
            ])->values(),
            'invoices' => $invoices->map(fn (Invoice $invoice) => [
                'uuid' => $invoice->uuid,
                'number' => $invoice->invoice_number,
                'status' => $invoice->status,
                'invoice_date' => $invoice->invoice_date->toDateString(),
                'due_date' => $invoice->due_date->toDateString(),
                'total' => $invoice->grandTotal()->format(),
                'balance' => $invoice->balance()->format(),
                'has_pdf' => $invoice->document_id !== null,
            ])->values(),
            'payments' => $payments->map(fn (Payment $payment) => [
                'uuid' => $payment->uuid,
                'amount' => $payment->amount()->format(),
                'method' => $payment->methodLabel(),
                'status' => $payment->status,
                'received_at' => $payment->received_at?->toIso8601String(),
                'invoice_number' => $payment->invoice?->invoice_number,
                'has_receipt' => $receipts->has($payment->id),
            ])->values(),
            'payment_providers' => array_map(
                fn ($gateway) => $gateway->key(),
                app(GatewayRegistry::class)->enabledProviders(),
            ),
            'notice' => 'Fees are for the service described on each invoice. Nothing here promises a return.',
        ]);
    }

    /**
     * Starts an online payment for an open invoice. Nothing is marked paid here: the provider's
     * signed callback is what settles the invoice.
     */
    public function payInvoice(Request $request, GatewayRegistry $registry, string $uuid): JsonResponse
    {
        $client = $this->client($request);
        $invoice = Invoice::query()->where(['uuid' => $uuid, 'client_id' => $client->id])->firstOrFail();

        if (! $invoice->isOpen()) {
            throw ApiException::unprocessable('INVOICE_NOT_OPEN', 'This invoice is not open for payment.');
        }

        $provider = $request->string('provider')->toString()
            ?: ($registry->enabledProviders()[0]->key() ?? '');

        if ($provider === '') {
            throw new ApiException('NO_PROVIDER', 'Online payment is not switched on yet. Your relationship manager will share payment details.', 503);
        }

        $intent = $registry->enabled($provider)->createIntent($invoice);

        return ApiResponse::success([
            'provider' => $provider,
            'reference' => $intent['reference'],
            'redirect_url' => $intent['redirect_url'],
            'payload' => $intent['payload'],
            'amount' => $invoice->balance()->format(),
        ]);
    }

    public function invoicePdf(Request $request, string $uuid): JsonResponse
    {
        $client = $this->client($request);
        $invoice = Invoice::query()->where(['uuid' => $uuid, 'client_id' => $client->id])->firstOrFail();

        if ($invoice->status === Invoice::DRAFT) {
            throw ApiException::unprocessable('NOT_ISSUED', 'This invoice has not been issued yet.');
        }

        $document = $invoice->document ?? $this->documents->invoicePdf($invoice, $request->user());

        return ApiResponse::success(['url' => $this->vault->temporaryUrl($request->user(), $document)]);
    }

    public function receiptPdf(Request $request, string $uuid): JsonResponse
    {
        $client = $this->client($request);
        $payment = Payment::query()->where(['uuid' => $uuid, 'client_id' => $client->id])->firstOrFail();
        $receipt = $this->documents->receiptFor($payment, $request->user());

        if ($receipt?->document === null) {
            throw ApiException::unprocessable('NO_RECEIPT', 'A receipt is issued once the payment has been verified.');
        }

        return ApiResponse::success(['url' => $this->vault->temporaryUrl($request->user(), $receipt->document)]);
    }

    private function client(Request $request): Client
    {
        $client = $request->user()->client;

        if ($client === null) {
            throw ApiException::unprocessable('NO_CLIENT_RECORD', 'Your client record is still being set up.');
        }

        return $client;
    }
}
