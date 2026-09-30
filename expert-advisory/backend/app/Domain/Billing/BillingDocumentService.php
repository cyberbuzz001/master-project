<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Onboarding\DocumentVault;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Invoice and receipt PDFs. Both carry a verification token and the SHA-256 of their own bytes, and
 * are filed in the document vault, so a printed copy can always be checked against the record.
 * Figures come from the stored invoice — the PDF never recalculates anything.
 */
final class BillingDocumentService
{
    public function __construct(private readonly DocumentVault $vault, private readonly AuditLogger $audit) {}

    public function invoicePdf(Invoice $invoice, ?User $actor = null): Document
    {
        if ($invoice->status === Invoice::DRAFT) {
            throw new \RuntimeException('A draft invoice has no PDF; issue it first.');
        }

        if ($invoice->document_id !== null) {
            return $invoice->document;
        }

        $invoice->loadMissing(['items', 'client']);
        $token = $invoice->verification_token ?? Str::lower(Str::random(40));

        $contents = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'items' => $invoice->items,
            'entity' => $invoice->legal_entity_snapshot ?? [],
            'client' => $invoice->client_snapshot ?? [],
            'verificationUrl' => $this->verificationUrl($token),
            'qr' => $this->qr($this->verificationUrl($token)),
            'terms' => config('billing.invoice.terms'),
        ])->setPaper('a4')->output();

        return DB::transaction(function () use ($invoice, $contents, $token, $actor): Document {
            $document = $this->vault->storeGenerated(
                $actor,
                'client',
                $invoice->client_id,
                'invoice',
                str_replace('/', '-', $invoice->invoice_number).'.pdf',
                $contents,
                'application/pdf',
                ['is_demo' => (bool) $invoice->is_demo, 'title' => 'Invoice '.$invoice->invoice_number],
            );

            $invoice->forceFill([
                'document_id' => $document->id,
                'pdf_sha256' => hash('sha256', $contents),
                'verification_token' => $token,
            ])->save();

            $this->audit->record('invoice.pdf_generated', $invoice, new: ['sha256' => $invoice->pdf_sha256], actor: $actor);

            return $document;
        });
    }

    /**
     * Issued once a payment is verified: the client's proof that we received the money.
     */
    public function receiptFor(Payment $payment, ?User $actor = null): ?Receipt
    {
        if (! $payment->isVerified()) {
            return null;
        }

        $existing = Receipt::query()->where('payment_id', $payment->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        $payment->loadMissing(['client', 'invoice']);
        $number = NumberSeries::next('receipt', $payment->verified_at ?? now());
        $token = Str::lower(Str::random(40));

        $contents = Pdf::loadView('pdf.receipt', [
            'payment' => $payment,
            'invoice' => $payment->invoice,
            'client' => $payment->client,
            'entity' => $payment->invoice?->legal_entity_snapshot ?? [],
            'receiptNumber' => $number,
            'verificationUrl' => $this->verificationUrl($token),
            'qr' => $this->qr($this->verificationUrl($token)),
        ])->setPaper('a4')->output();

        return DB::transaction(function () use ($payment, $contents, $number, $token, $actor): Receipt {
            $document = $this->vault->storeGenerated(
                $actor,
                'client',
                $payment->client_id,
                'receipt',
                str_replace('/', '-', $number).'.pdf',
                $contents,
                'application/pdf',
                ['is_demo' => (bool) $payment->is_demo, 'title' => 'Receipt '.$number],
            );

            $receipt = Receipt::create([
                'payment_id' => $payment->id,
                'receipt_number' => $number,
                'pdf_sha256' => hash('sha256', $contents),
                'verification_token' => $token,
                'document_id' => $document->id,
            ]);

            $this->audit->record('receipt.issued', $receipt, new: [
                'receipt_number' => $number, 'payment_id' => $payment->id, 'amount_paise' => $payment->amount_paise,
            ], actor: $actor);

            return $receipt;
        });
    }

    private function verificationUrl(string $token): string
    {
        return rtrim((string) config('platform.frontend_url'), '/').'/verify/'.$token;
    }

    private function qr(string $url): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(150, 1), new SvgImageBackEnd));

        return 'data:image/svg+xml;base64,'.base64_encode($writer->writeString($url));
    }
}
