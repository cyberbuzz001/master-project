<?php

namespace App\Domain\Crm;

use App\Models\Lead;
use App\Models\LeadImportBatch;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;

class VendorPerformanceService
{
    /**
     * Get aggregated performance analytics across all vendors / lead sources.
     *
     * @param array $filters [start_date, end_date, vendor_id]
     * @return array
     */
    public function getVendorMetrics(array $filters = []): array
    {
        $vendors = Vendor::query();
        if (!empty($filters['vendor_id'])) {
            $vendors->where('id', $filters['vendor_id']);
        }
        $vendorList = $vendors->get();

        $report = [];

        foreach ($vendorList as $vendor) {
            $leadQuery = Lead::where('vendor_id', $vendor->id);

            if (!empty($filters['start_date'])) {
                $leadQuery->whereDate('created_at', '>=', $filters['start_date']);
            }
            if (!empty($filters['end_date'])) {
                $leadQuery->whereDate('created_at', '<=', $filters['end_date']);
            }

            $totalLeads = (clone $leadQuery)->count();
            if ($totalLeads === 0) {
                $report[] = [
                    'vendor_id' => $vendor->id,
                    'vendor_name' => $vendor->name,
                    'total_leads' => 0,
                    'valid_numbers' => 0,
                    'valid_rate' => 0.0,
                    'verified_consent' => 0,
                    'consent_rate' => 0.0,
                    'whatsapp_replies' => 0,
                    'reply_rate' => 0.0,
                    'demos_requested' => 0,
                    'demo_rate' => 0.0,
                    'appointments_booked' => 0,
                    'appointment_rate' => 0.0,
                    'paid_conversions' => 0,
                    'conversion_rate' => 0.0,
                    'total_revenue_inr' => 0.0,
                    'cost_per_lead' => (float) ($vendor->cost_per_lead ?? 0),
                    'total_spend' => 0.0,
                    'roi' => 0.0,
                ];
                continue;
            }

            $validNumbers = (clone $leadQuery)->whereNotNull('mobile')->where('status', '!=', 'INVALID')->count();
            $verifiedConsent = (clone $leadQuery)->whereIn('communication_state', ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])->count();
            $repliedCount = (clone $leadQuery)->whereNotNull('last_whatsapp_received_at')->count();
            $demoCount = (clone $leadQuery)->where(function ($q) {
                $q->whereNotNull('demo_requested_at')
                  ->orWhereIn('ai_conversation_state', ['DEMO_REQUESTED', 'DEMO_BOOKED']);
            })->count();

            $appointmentCount = (clone $leadQuery)->where(function ($q) {
                $q->whereNotNull('appointment_requested_at')
                  ->orWhereIn('ai_conversation_state', ['APPOINTMENT_REQUESTED', 'APPOINTMENT_BOOKED']);
            })->count();

            $paidCount = (clone $leadQuery)->whereIn('status', ['PAID', 'CONVERTED'])->count();

            $costPerLead = (float) ($vendor->cost_per_lead ?? 0);
            $totalSpend = round($totalLeads * $costPerLead, 2);

            // Fetch actual settled payments attributed to this vendor's leads
            $revenuePaise = DB::table('payments')
                ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
                ->join('clients', 'invoices.client_id', '=', 'clients.id')
                ->join('leads', 'clients.lead_id', '=', 'leads.id')
                ->where('leads.vendor_id', $vendor->id)
                ->where('payments.status', 'succeeded')
                ->sum('payments.amount_paise');

            $revenueInr = round($revenuePaise / 100, 2);
            $roi = $totalSpend > 0 ? round(($revenueInr - $totalSpend) / $totalSpend * 100, 2) : 0.0;

            $report[] = [
                'vendor_id' => $vendor->id,
                'vendor_name' => $vendor->name,
                'total_leads' => $totalLeads,
                'valid_numbers' => $validNumbers,
                'valid_rate' => round(($validNumbers / $totalLeads) * 100, 1),
                'verified_consent' => $verifiedConsent,
                'consent_rate' => round(($verifiedConsent / $totalLeads) * 100, 1),
                'whatsapp_replies' => $repliedCount,
                'reply_rate' => round(($repliedCount / $totalLeads) * 100, 1),
                'demos_requested' => $demoCount,
                'demo_rate' => round(($demoCount / $totalLeads) * 100, 1),
                'appointments_booked' => $appointmentCount,
                'appointment_rate' => round(($appointmentCount / $totalLeads) * 100, 1),
                'paid_conversions' => $paidCount,
                'conversion_rate' => round(($paidCount / $totalLeads) * 100, 1),
                'total_revenue_inr' => $revenueInr,
                'cost_per_lead' => $costPerLead,
                'total_spend' => $totalSpend,
                'roi' => $roi,
            ];
        }

        return $report;
    }

    /**
     * Get overall batch and import quality metrics.
     */
    public function getImportBatchMetrics(): array
    {
        $batches = LeadImportBatch::with('vendor')
            ->orderByDesc('id')
            ->take(20)
            ->get();

        return $batches->map(function (LeadImportBatch $batch) {
            $total = $batch->total_rows_detected;
            return [
                'batch_id' => $batch->id,
                'batch_code' => $batch->batch_code,
                'file_name' => $batch->original_filename,
                'vendor_name' => $batch->vendor?->name ?? 'Direct Upload',
                'format_detected' => $batch->detected_format,
                'total_rows' => $total,
                'accepted_count' => $batch->accepted_count,
                'rejected_count' => $batch->rejected_count,
                'duplicate_count' => $batch->duplicate_in_file_count + $batch->duplicate_in_crm_count,
                'validity_rate' => $total > 0 ? round(($batch->accepted_count / $total) * 100, 1) : 0,
                'consent_basis' => $batch->consent_basis,
                'created_at' => $batch->created_at?->format('Y-m-d H:i:s'),
            ];
        })->toArray();
    }
}
