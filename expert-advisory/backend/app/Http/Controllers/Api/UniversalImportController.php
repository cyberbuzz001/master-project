<?php

namespace App\Http\Controllers\Api;

use App\Domain\Crm\UniversalLeadImporter;
use App\Http\Controllers\Controller;
use App\Models\LeadImportBatch;
use App\Models\LeadImportPreview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;

class UniversalImportController extends Controller
{
    public function __construct(protected UniversalLeadImporter $importer) {}

    public function preview(Request $request): JsonResponse
    {
        Gate::authorize('leads.import');
        $request->validate([
            'file' => ['nullable', 'file', 'max:4096', 'mimes:csv,txt,xlsx,png,jpg,jpeg,webp', 'extensions:csv,txt,xlsx,png,jpg,jpeg,webp', 'required_without:raw_text'],
            'raw_text' => ['nullable', 'string', 'max:100000', 'required_without:file'],
        ]);
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $ext = strtolower($file->getClientOriginalExtension());
            $rows = in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)
             ? $this->importer->parseImageScreenshot($file->getRealPath())
             : $this->importer->parseSpreadsheetFile($file->getRealPath(), $ext);
        } else {
            $rows = $this->importer->parseRawText($request->string('raw_text')->toString());
        }
        $preview = $this->importer->createPreview($rows, $request->user());
        $payload = $preview->payload;
        $payload['rows'] = array_map(fn (array $row): array => Arr::except($row, ['existing_lead_id', 'existing_lead_name', 'existing_lead_status', 'existing_lead_has_richer_data']), $payload['rows']);

        return response()->json(['success' => true, 'data' => [
            ...$payload, 'preview_id' => $preview->id, 'expires_at' => $preview->expires_at->toIso8601String(),
        ]]);
    }

    public function execute(Request $request): JsonResponse
    {
        Gate::authorize('leads.import');
        $data = $request->validate([
            'preview_id' => ['required', 'uuid'], 'options' => ['required', 'array'],
            'preview_result' => ['prohibited'],
        ]);
        $batch = $this->importer->commitPreview($data['preview_id'], $data['options'], $request->user());

        return response()->json(['success' => true, 'message' => "Import complete. {$batch->accepted_count} leads accepted.", 'batch' => $batch], 201);
    }

    public function batches(Request $request): JsonResponse
    {
        Gate::authorize('leads.import');
        $query = LeadImportBatch::query()->with(['vendor', 'campaign', 'uploadedBy'])->latest('id');
        if (! $request->user()->can('leads.view_all')) {
            $query->where('uploaded_by_id', $request->user()->id);
        }

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function showBatch(Request $request, int $id): JsonResponse
    {
        $batch = LeadImportBatch::with(['vendor', 'campaign', 'uploadedBy'])->findOrFail($id);
        Gate::authorize('view', $batch);

        return response()->json(['success' => true, 'data' => $batch]);
    }

    public function downloadReport(Request $request): Response
    {
        Gate::authorize('leads.import');
        $data = $request->validate(['batch_id' => ['required', 'integer']]);
        $batch = LeadImportBatch::findOrFail($data['batch_id']);
        Gate::authorize('view', $batch);
        $preview = LeadImportPreview::where('lead_import_batch_id', $batch->id)->first();
        $csv = $this->importer->generateValidationReportCsv($preview?->payload['rows'] ?? $batch);

        return response($csv, 200, ['Content-Type' => 'text/csv', 'Content-Disposition' => 'attachment; filename="lead_import_validation_report.csv"']);
    }
}
