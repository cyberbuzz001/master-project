<?php

namespace App\Http\Controllers\Api;

use App\Domain\Crm\UniversalLeadImporter;
use App\Http\Controllers\Controller;
use App\Models\LeadImportBatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class UniversalImportController extends Controller
{
    public function __construct(
        protected UniversalLeadImporter $importer
    ) {
    }

    /**
     * Preview and pre-validate leads from text, spreadsheet, or screenshot.
     */
    public function preview(Request $request): JsonResponse
    {
        $parsedRows = [];
        $formatDetected = 'auto_detected';

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $ext = strtolower($file->getClientOriginalExtension());
            $path = $file->getRealPath();

            if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp'])) {
                $formatDetected = 'screenshot_ocr';
                $parsedRows = $this->importer->parseImageScreenshot($path);
            } else {
                $formatDetected = in_array($ext, ['xlsx', 'xls']) ? 'excel' : 'csv';
                $parsedRows = $this->importer->parseSpreadsheetFile($path, $ext);
            }
        } elseif ($request->filled('raw_text')) {
            $formatDetected = 'raw_text';
            $parsedRows = $this->importer->parseRawText($request->input('raw_text'));
        } else {
            return response()->json([
                'success' => false,
                'error' => 'Please provide an uploaded file (XLSX, CSV, Image) or paste lead text.',
            ], 422);
        }

        $vendorId = $request->input('vendor_id');
        $previewResult = $this->importer->previewAndValidate($parsedRows, $vendorId ? (int) $vendorId : null);
        $previewResult['format_detected'] = $formatDetected;

        return response()->json([
            'success' => true,
            'data' => $previewResult,
        ]);
    }

    /**
     * Execute the validated import batch.
     */
    public function execute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preview_result' => 'required|array',
            'preview_result.summary' => 'required|array',
            'preview_result.rows' => 'required|array',
            'options' => 'required|array',
            'options.consent_basis' => 'required|string|min:10',
            'options.consent_whatsapp' => 'nullable|boolean',
            'options.consent_calls' => 'nullable|boolean',
            'options.vendor_id' => 'nullable|integer',
            'options.campaign_id' => 'nullable|integer',
            'options.assign_to_employee_id' => 'nullable|integer',
            'options.duplicate_strategy' => 'nullable|string|in:skip,update_empty_fields',
            'options.original_filename' => 'nullable|string',
            'options.import_format' => 'nullable|string',
        ]);

        $user = $request->user();
        $batch = $this->importer->executeImport(
            $validated['preview_result'],
            $validated['options'],
            $user
        );

        return response()->json([
            'success' => true,
            'message' => "Import complete. {$batch->accepted_count} leads successfully ingested into Batch {$batch->batch_code}.",
            'batch' => $batch,
        ], 201);
    }

    /**
     * List all import batches with vendor attribution and performance stats.
     */
    public function batches(): JsonResponse
    {
        $batches = LeadImportBatch::with(['vendor', 'campaign', 'uploadedBy'])
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $batches,
        ]);
    }

    /**
     * Get details of a single batch.
     */
    public function showBatch(int $id): JsonResponse
    {
        $batch = LeadImportBatch::with(['vendor', 'campaign', 'uploadedBy'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $batch,
        ]);
    }

    /**
     * Download CSV validation report for a batch.
     */
    public function downloadReport(Request $request): Response
    {
        $rows = $request->input('rows', []);
        $csvText = $this->importer->generateValidationReportCsv($rows);

        return response($csvText, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="lead_import_validation_report.csv"',
        ]);
    }
}
