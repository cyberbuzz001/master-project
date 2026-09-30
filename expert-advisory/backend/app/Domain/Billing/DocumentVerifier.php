<?php

namespace App\Domain\Billing;

use App\Models\Invoice;
use App\Models\Receipt;
use App\Models\RiskProfile;
use App\Models\RiskReport;

/**
 * One public check for every document we hand a client: risk report, invoice or receipt. It confirms
 * the document came from us and whether it still stands; it never returns personal details.
 */
final class DocumentVerifier
{
    /**
     * @return array<string, mixed>|null
     */
    public function verify(string $token): ?array
    {
        return $this->riskReport($token) ?? $this->invoice($token) ?? $this->receipt($token);
    }

    private function riskReport(string $token): ?array
    {
        $report = RiskReport::query()->where('verification_token', $token)->with('riskProfile.questionnaireVersion')->first();

        if ($report === null) {
            return null;
        }

        $profile = $report->riskProfile;

        return [
            'type' => 'risk_report',
            'type_label' => 'Risk profile report',
            'number' => $report->report_number,
            'issued_on' => $report->created_at->toDateString(),
            'still_current' => $profile->status !== RiskProfile::SUPERSEDED,
            'superseded' => $profile->status === RiskProfile::SUPERSEDED,
            'pdf_sha256' => $report->pdf_sha256,
            'is_demo' => (bool) $profile->is_demo,
            'details' => [
                'Risk category recorded' => $profile->questionnaireVersion->bandLabels()[$profile->risk_category] ?? $profile->risk_category,
                'Scoring methodology' => $profile->methodology_version,
                'Assessment taken on' => $profile->created_at->toDateString(),
            ],
        ];
    }

    private function invoice(string $token): ?array
    {
        $invoice = Invoice::query()->withoutGlobalScopes()->where('verification_token', $token)->first();

        if ($invoice === null) {
            return null;
        }

        return [
            'type' => 'invoice',
            'type_label' => 'Invoice',
            'number' => $invoice->invoice_number,
            'issued_on' => $invoice->invoice_date->toDateString(),
            'still_current' => $invoice->status !== Invoice::VOID,
            'superseded' => $invoice->status === Invoice::VOID,
            'pdf_sha256' => $invoice->pdf_sha256,
            'is_demo' => (bool) $invoice->is_demo,
            'details' => array_filter([
                'Amount' => $invoice->grandTotal()->format(),
                'Status' => str($invoice->status)->replace('_', ' ')->ucfirst()->toString(),
                'Due date' => $invoice->due_date->toDateString(),
                'Voided' => $invoice->status === Invoice::VOID ? $invoice->voided_at?->toDateString() : null,
            ]),
        ];
    }

    private function receipt(string $token): ?array
    {
        $receipt = Receipt::query()->where('verification_token', $token)->with('payment.invoice')->first();

        if ($receipt === null) {
            return null;
        }

        $payment = $receipt->payment;

        return [
            'type' => 'receipt',
            'type_label' => 'Payment receipt',
            'number' => $receipt->receipt_number,
            'issued_on' => $receipt->created_at->toDateString(),
            'still_current' => $payment->status !== 'refunded',
            'superseded' => $payment->status === 'refunded',
            'pdf_sha256' => $receipt->pdf_sha256,
            'is_demo' => (bool) $payment->is_demo,
            'details' => array_filter([
                'Amount received' => $payment->amount()->format(),
                'Method' => $payment->methodLabel(),
                'Received on' => $payment->received_at?->toDateString(),
                'Against invoice' => $payment->invoice?->invoice_number,
                'Refunded' => $payment->status === 'refunded' ? 'Yes' : null,
            ]),
        ];
    }
}
