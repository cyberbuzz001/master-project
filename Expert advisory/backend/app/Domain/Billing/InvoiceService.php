<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\RegulatoryProfileService;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PlanVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Invoice totals are calculated on the server from the stored plan price and tax code — never from a
 * number sent by a browser. Issuing freezes the invoice and snapshots who billed whom, so the record
 * still reads correctly after entity details or prices change.
 */
final class InvoiceService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RegulatoryProfileService $profiles,
        private readonly BillingDocumentService $documents,
    ) {}

    /**
     * @param  list<array{plan_version_id?: int, description?: string, quantity?: int, unit_price_paise?: int, discount_paise?: int, tax_code?: string}>  $lines
     */
    public function draft(User $actor, Client $client, array $lines, array $attributes = []): Invoice
    {
        if (! $actor->can('invoices.create')) {
            throw ApiException::forbidden('You are not allowed to create invoices.');
        }

        if ($lines === []) {
            throw ApiException::unprocessable('NO_LINES', 'An invoice needs at least one line.');
        }

        return DB::transaction(function () use ($actor, $client, $lines, $attributes): Invoice {
            $invoice = new Invoice([
                'client_id' => $client->id,
                'invoice_date' => $attributes['invoice_date'] ?? now()->toDateString(),
                'due_date' => $attributes['due_date'] ?? now()->addDays((int) config('billing.invoice.due_days'))->toDateString(),
                'notes' => $attributes['notes'] ?? null,
                'place_of_supply' => $attributes['place_of_supply'] ?? $client->state,
                'is_demo' => (bool) $client->is_demo,
            ]);
            // A draft carries a placeholder number; the real one is taken from the series at issue.
            $invoice->forceFill([
                'invoice_number' => 'DRAFT-'.Str::upper(Str::random(10)),
                'client_snapshot' => $this->clientSnapshot($client),
                'created_by' => $actor->id,
            ])->save();

            $sort = 0;

            foreach ($lines as $line) {
                $this->addLine($invoice, $line, $sort++);
            }

            $this->recalculate($invoice);
            $this->audit->record('invoice.drafted', $invoice, new: ['client_id' => $client->id, 'grand_total_paise' => $invoice->grand_total_paise], actor: $actor);

            return $invoice->refresh();
        });
    }

    /**
     * Assigns the real number, snapshots the entity details and freezes the document.
     */
    public function issue(User $actor, Invoice $invoice): Invoice
    {
        if (! $actor->can('invoices.create')) {
            throw ApiException::forbidden('You are not allowed to issue invoices.');
        }

        if ($invoice->status !== Invoice::DRAFT) {
            throw ApiException::invalidTransition($invoice->status, Invoice::ISSUED);
        }

        if ($invoice->items()->count() === 0) {
            throw ApiException::unprocessable('NO_LINES', 'Add at least one line before issuing.');
        }

        $this->recalculate($invoice);

        if ((int) $invoice->grand_total_paise <= 0) {
            throw ApiException::unprocessable('ZERO_TOTAL', 'An invoice must be for more than zero.');
        }

        return DB::transaction(function () use ($actor, $invoice): Invoice {
            $invoice->forceFill([
                'invoice_number' => NumberSeries::next('invoice', $invoice->invoice_date),
                'legal_entity_snapshot' => $this->entitySnapshot(),
                'status' => Invoice::ISSUED,
                'issued_by' => $actor->id,
                'issued_at' => now(),
            ])->save();

            $this->audit->record('invoice.issued', $invoice, new: [
                'invoice_number' => $invoice->invoice_number,
                'grand_total_paise' => $invoice->grand_total_paise,
            ], actor: $actor);

            // The client's copy is produced at issue, so what they hold matches the record exactly.
            $this->documents->invoicePdf($invoice, $actor);

            return $invoice->refresh();
        });
    }

    public function void(User $actor, Invoice $invoice, string $reason): Invoice
    {
        if (! $actor->can('invoices.void')) {
            throw ApiException::forbidden('You are not allowed to void invoices.');
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give a reason for voiding this invoice.');
        }

        if ($invoice->status === Invoice::VOID) {
            throw ApiException::unprocessable('ALREADY_VOID', 'This invoice is already void.');
        }

        if ((int) $invoice->amount_paid_paise > 0) {
            throw ApiException::unprocessable('PAYMENTS_RECEIVED', 'Money has been received against this invoice. Refund it before voiding.');
        }

        $invoice->forceFill([
            'status' => Invoice::VOID,
            'void_reason' => $reason,
            'voided_by' => $actor->id,
            'voided_at' => now(),
            'balance_paise' => 0,
        ])->save();

        $this->audit->record('invoice.voided', $invoice, new: ['status' => Invoice::VOID], reason: $reason, actor: $actor);

        return $invoice;
    }

    /**
     * Recomputes every line and the totals from the stored inputs. Deterministic: same inputs, same paise.
     */
    public function recalculate(Invoice $invoice): Invoice
    {
        $subtotal = Money::zero($invoice->currency);
        $discount = Money::zero($invoice->currency);
        $tax = Money::zero($invoice->currency);

        foreach ($invoice->items()->get() as $item) {
            $gross = Money::paise((int) $item->unit_price_paise, $invoice->currency)->times((int) $item->quantity);
            $lineDiscount = Money::paise((int) $item->discount_paise, $invoice->currency);

            if ($lineDiscount->greaterThan($gross)) {
                throw ApiException::unprocessable('DISCOUNT_TOO_LARGE', 'A discount cannot exceed the line amount.');
            }

            $taxable = $gross->minus($lineDiscount);
            $rate = (float) config("billing.tax_codes.{$item->tax_code}.rate", (float) $item->tax_rate_percent);
            $lineTax = $taxable->percentage($rate);

            $item->forceFill([
                'tax_rate_percent' => $rate,
                'taxable_paise' => $taxable->paise,
                'tax_paise' => $lineTax->paise,
                'line_total_paise' => $taxable->plus($lineTax)->paise,
            ])->save();

            $subtotal = $subtotal->plus($gross);
            $discount = $discount->plus($lineDiscount);
            $tax = $tax->plus($lineTax);
        }

        $grand = $subtotal->minus($discount)->plus($tax);
        $paid = Money::paise((int) $invoice->amount_paid_paise, $invoice->currency);

        $invoice->forceFill([
            'subtotal_paise' => $subtotal->paise,
            'discount_total_paise' => $discount->paise,
            'tax_total_paise' => $tax->paise,
            'grand_total_paise' => $grand->paise,
            'balance_paise' => $grand->minus($paid)->paise,
        ])->save();

        return $invoice;
    }

    /**
     * Recomputes payment state from verified payments only.
     */
    public function refreshPaymentState(Invoice $invoice): Invoice
    {
        if ($invoice->status === Invoice::VOID) {
            return $invoice;
        }

        $paid = Money::paise((int) $invoice->payments()->where('status', 'succeeded')->sum('amount_paise'), $invoice->currency);
        $grand = $invoice->grandTotal();
        $balance = $grand->minus($paid);

        $status = match (true) {
            $paid->isZero() => $invoice->due_date->isPast() ? Invoice::OVERDUE : Invoice::ISSUED,
            $balance->paise <= 0 => Invoice::PAID,
            default => Invoice::PARTIALLY_PAID,
        };

        $invoice->forceFill([
            'amount_paid_paise' => $paid->paise,
            'balance_paise' => $balance->paise,
            'status' => $invoice->status === Invoice::DRAFT ? Invoice::DRAFT : $status,
        ])->save();

        return $invoice;
    }

    /**
     * @param  array<string, mixed>  $line
     */
    public function addLine(Invoice $invoice, array $line, int $sort = 0): InvoiceItem
    {
        if ($invoice->status !== Invoice::DRAFT) {
            throw ApiException::unprocessable('INVOICE_ISSUED', 'Lines cannot be added to an issued invoice.');
        }

        if (isset($line['plan_version_id'])) {
            $version = PlanVersion::query()->with('plan')->findOrFail($line['plan_version_id']);

            if ($version->status !== PlanVersion::PUBLISHED) {
                throw ApiException::unprocessable('PRICE_NOT_PUBLISHED', 'That price is not published.');
            }

            $line += [
                'description' => $version->plan->service->name.' — '.$version->plan->name.' ('.$version->plan->cycleLabel().')',
                'unit_price_paise' => (int) $version->base_price_paise,
                'tax_code' => $version->tax_code ?? config('billing.default_tax_code'),
            ];
        }

        foreach (['description', 'unit_price_paise'] as $required) {
            if (! isset($line[$required])) {
                throw ApiException::unprocessable('LINE_INCOMPLETE', 'Each line needs a description and a price.');
            }
        }

        if ((int) $line['unit_price_paise'] < 0) {
            throw ApiException::unprocessable('NEGATIVE_PRICE', 'A price cannot be negative.');
        }

        return InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'plan_version_id' => $line['plan_version_id'] ?? null,
            'description' => $line['description'],
            'quantity' => max(1, (int) ($line['quantity'] ?? 1)),
            'unit_price_paise' => (int) $line['unit_price_paise'],
            'discount_paise' => max(0, (int) ($line['discount_paise'] ?? 0)),
            'tax_code' => $line['tax_code'] ?? config('billing.default_tax_code'),
            'sort_order' => $sort,
        ]);
    }

    private function clientSnapshot(Client $client): array
    {
        return array_filter([
            'client_code' => $client->client_code,
            'name' => $client->full_name,
            'email' => $client->email,
            'mobile' => $client->mobile,
            'city' => $client->city,
            'state' => $client->state,
            'country' => $client->country,
        ], fn ($value) => $value !== null);
    }

    /**
     * Only a verified regulatory profile is printed on an invoice; unverified details never appear.
     */
    private function entitySnapshot(): array
    {
        $profile = $this->profiles->active();

        if ($profile === null) {
            return ['name' => config('app.name'), 'verified' => false];
        }

        return array_filter([
            'verified' => true,
            'legal_entity_name' => $profile->legal_entity_name,
            'brand_name' => $profile->brand_name,
            'research_status' => $profile->research_status,
            'registration_number' => $profile->registration_number,
            'grievance_officer_name' => $profile->grievance_officer_name,
            'grievance_officer_email' => $profile->grievance_officer_email,
            'grievance_officer_phone' => $profile->grievance_officer_phone,
        ], fn ($value) => $value !== null);
    }
}
