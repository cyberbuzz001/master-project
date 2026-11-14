<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Shared\ApiException;
use App\Models\Employee;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadAttribution;
use App\Models\LeadImportBatch;
use App\Models\LeadImportPreview;
use App\Models\LeadSource;
use App\Models\LeadStatusHistory;
use App\Models\SuppressionRecord;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use OpenSpout\Reader\CSV\Reader as CsvReader;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;

class UniversalLeadImporter
{
    /**
     * Parse raw pasted text into normalized rows.
     * Handles:
     * 1. Format 1: Single column mobile numbers (Image 2)
     * 2. Format 2: Name | Mobile (Image 1) or Name - Mobile
     * 3. Format 3: Multi-column delimited (Name | Mobile | City | Source)
     * 4. Format 4: Vertical Key-Value alternating rows (Image 3: "fullName" | "...", "mobile" | "...")
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseRawText(string $rawText): array
    {
        $rawText = trim($rawText);
        if (empty($rawText)) {
            return [];
        }

        $lines = preg_split('/\r\n|\r|\n/', $rawText);
        $cleanLines = [];
        foreach ($lines as $line) {
            $t = trim($line);
            if ($t !== '') {
                $cleanLines[] = $t;
            }
        }

        if (empty($cleanLines)) {
            return [];
        }

        // Check if input is Vertical Key-Value structure (Image 3)
        if ($this->isVerticalKvStructure($cleanLines)) {
            return $this->parseVerticalKvLines($cleanLines);
        }

        // Parse tabular lines
        $parsed = [];
        $hasHeader = false;
        $headerMap = [];

        // Check if first line is a header
        $firstLine = $cleanLines[0];
        $firstParts = $this->splitLine($firstLine);
        $detectedHeader = $this->detectHeaderColumns($firstParts);

        if (! empty($detectedHeader['mobile']) || ! empty($detectedHeader['name'])) {
            $hasHeader = true;
            $headerMap = $detectedHeader;
            array_shift($cleanLines);
        }

        foreach ($cleanLines as $lineIdx => $line) {
            $parts = $this->splitLine($line);
            if (empty($parts)) {
                continue;
            }

            if ($hasHeader) {
                $row = $this->mapRowUsingHeader($parts, $headerMap, $lineIdx + 1);
            } else {
                $row = $this->inferRowStructure($parts, $lineIdx + 1);
            }

            if ($row !== null) {
                $parsed[] = $row;
            }
        }

        return $parsed;
    }

    /**
     * Parse Excel (.xlsx, .xls) or CSV files using OpenSpout.
     *
     * @param  string  $filePath  Absolute path to file
     * @return array<int, array<string, mixed>>
     */
    public function parseSpreadsheetFile(string $filePath, ?string $extension = null): array
    {
        $extension = strtolower($extension ?: pathinfo($filePath, PATHINFO_EXTENSION));

        if ($extension === 'csv' || $extension === 'txt') {
            return $this->parseCsvFile($filePath);
        }

        if ($extension !== 'xlsx') {
            throw ValidationException::withMessages(['file' => 'Use CSV, TXT or XLSX. Legacy XLS is not supported.']);
        }

        return $this->parseXlsxFile($filePath);
    }

    /**
     * Parse image / screenshot of lead lists using OCR or AI Vision.
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseImageScreenshot(string $filePath): array
    {
        if (! file_exists($filePath)) {
            return [];
        }

        $apiKey = config('ai.providers.gemini.key', env('GEMINI_API_KEY'));
        if (empty($apiKey)) {
            // If no vision API key is configured, return empty with error flag
            return [
                [
                    'raw_line' => 'Screenshot OCR requires GEMINI_API_KEY or OPENAI_API_KEY configured.',
                    'full_name' => 'Unnamed Lead',
                    'mobile' => null,
                    'is_valid' => false,
                    'error_reason' => 'AI Vision OCR service requires an API key in .env',
                    'uncertain_ocr' => true,
                ],
            ];
        }

        try {
            $imageBytes = file_get_contents($filePath);
            $mimeType = mime_content_type($filePath) ?: 'image/jpeg';
            $base64Data = base64_encode($imageBytes);

            $prompt = 'You are a precise OCR data extraction agent for an enterprise CRM.
Extract all lead records from this image.
Notice the structure:
- If it has names and phone numbers, extract both.
- If it is only phone numbers, extract the numbers.
- If it has key-value pairs (like "fullName", "mobile"), group them per person.
- Preserve all digits of Indian phone numbers.
Return a STRICT JSON array of objects with keys:
"full_name": string or null (do not invent names if not present),
"mobile": string (clean digits only),
"confidence": float between 0.0 and 1.0.
Output ONLY the raw JSON array without markdown formatting.';

            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={$apiKey}";
            $response = Http::timeout(45)->post($url, [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt],
                            [
                                'inlineData' => [
                                    'mimeType' => $mimeType,
                                    'data' => $base64Data,
                                ],
                            ],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.1,
                ],
            ]);

            if ($response->successful()) {
                $rawOutput = $response->json('candidates.0.content.parts.0.text') ?? '[]';
                $cleanJson = trim(preg_replace('/^```json|```$/m', '', $rawOutput));
                $decoded = json_decode($cleanJson, true);

                if (is_array($decoded)) {
                    $rows = [];
                    foreach ($decoded as $idx => $item) {
                        $rawPhone = (string) ($item['mobile'] ?? '');
                        $confidence = (float) ($item['confidence'] ?? 0.0);
                        $name = ! empty($item['full_name']) ? trim($item['full_name']) : 'Unnamed Lead';

                        $normalized = PhoneNormalizer::toE164($rawPhone);
                        $isValid = $normalized !== null;
                        $uncertain = $confidence < 0.85 || strlen(preg_replace('/\D/', '', $rawPhone)) !== 10;

                        $rows[] = [
                            'row_number' => $idx + 1,
                            'full_name' => $name,
                            'raw_mobile' => $rawPhone,
                            'mobile_e164' => $normalized,
                            'phone_only' => empty($item['full_name']),
                            'is_valid' => $isValid,
                            'error_reason' => $isValid ? null : 'Uncertain or invalid phone digits extracted from screenshot',
                            'uncertain_ocr' => $uncertain,
                            'ocr_confidence' => $confidence,
                            'raw_line' => json_encode($item),
                        ];
                    }

                    return $rows;
                }
            }
        } catch (Exception $e) {
            Log::error('[UniversalLeadImporter] Image OCR error:', ['error' => $e->getMessage()]);
        }

        return [];
    }

    /**
     * Interactive Preview and Pre-Validation Analysis.
     * Evaluates valid numbers, duplicates in file, duplicates in CRM, richer records, and suppression.
     *
     * @param  array<int, array<string, mixed>>  $parsedRows
     * @return array<string, mixed>
     */
    public function previewAndValidate(array $parsedRows, ?int $vendorId = null): array
    {
        $totalRows = count($parsedRows);
        $validCount = 0;
        $nameAndPhoneCount = 0;
        $phoneOnlyCount = 0;
        $duplicateInFileCount = 0;
        $duplicateInCrmCount = 0;
        $invalidCount = 0;
        $uncertainOcrCount = 0;
        $suppressedCount = 0;

        $seenInFile = [];
        $allValidPhones = [];

        foreach ($parsedRows as $row) {
            if (! empty($row['mobile_e164'])) {
                $allValidPhones[] = $row['mobile_e164'];
            }
        }

        // Bulk query all existing leads in CRM. A mobile number identifies a lead permanently;
        // historical records must not be re-imported as fresh leads after a time window.
        $existingCrmLeads = [];
        if (! empty($allValidPhones)) {
            $existingCrmLeads = Lead::query()
                ->whereIn('mobile', $allValidPhones)
                ->get()
                ->keyBy('mobile')
                ->all();
        }

        // Bulk query suppressions
        $suppressedPhones = [];
        if (! empty($allValidPhones)) {
            $suppressedPhones = SuppressionRecord::query()
                ->whereIn('phone_e164', $allValidPhones)
                ->pluck('reason', 'phone_e164')
                ->toArray();
        }

        $analyzedRows = [];

        foreach ($parsedRows as $idx => $row) {
            $mobileE164 = $row['mobile_e164'] ?? null;
            $name = $row['full_name'] ?? 'Unnamed Lead';
            $uncertainOcr = ! empty($row['uncertain_ocr']);

            if ($uncertainOcr) {
                $uncertainOcrCount++;
            }

            if ($uncertainOcr) {
                $invalidCount++;
                $row['validation_status'] = 'uncertain_ocr';
                $row['action_recommended'] = 'correct_source_and_upload_again';
                $row['error_reason'] = 'OCR digits require human verification before import.';
                $analyzedRows[] = $row;

                continue;
            }
            if (empty($mobileE164) || ! ($row['is_valid'] ?? false)) {
                $invalidCount++;
                $row['validation_status'] = 'invalid_phone';
                $row['action_recommended'] = 'reject';
                $row['error_reason'] = ($row['error_reason'] ?? null) ?: 'Invalid phone number format or length';
                $analyzedRows[] = $row;

                continue;
            }

            // Check Suppression
            if (isset($suppressedPhones[$mobileE164])) {
                $suppressedCount++;
                $row['validation_status'] = 'suppressed';
                $row['action_recommended'] = 'skip_suppressed';
                $row['error_reason'] = 'Contact has previously opted out or is on DND: '.$suppressedPhones[$mobileE164];
                $analyzedRows[] = $row;

                continue;
            }

            // Check Duplicate in File
            if (isset($seenInFile[$mobileE164])) {
                $duplicateInFileCount++;
                $row['validation_status'] = 'duplicate_in_file';
                $row['action_recommended'] = 'skip_duplicate';
                $row['error_reason'] = 'Duplicate phone number found in row '.$seenInFile[$mobileE164];
                $analyzedRows[] = $row;

                continue;
            }
            $seenInFile[$mobileE164] = $row['row_number'] ?? ($idx + 1);

            // Check Duplicate in CRM
            if (isset($existingCrmLeads[$mobileE164])) {
                $existing = $existingCrmLeads[$mobileE164];
                $duplicateInCrmCount++;
                $row['validation_status'] = 'duplicate_in_crm';
                $row['action_recommended'] = 'preserve_existing';
                $row['existing_lead_id'] = $existing->id;
                $row['existing_lead_name'] = $existing->full_name;
                $row['existing_lead_status'] = $existing->status;
                $row['existing_lead_has_richer_data'] = ! empty($existing->assigned_employee_id) || $existing->activities()->count() > 0;
                $row['error_reason'] = "Lead already exists in CRM (#{$existing->id}: {$existing->full_name}, Status: {$existing->status})";
                $analyzedRows[] = $row;

                continue;
            }

            // Valid New Record
            $validCount++;
            if (! empty($row['phone_only'])) {
                $phoneOnlyCount++;
            } else {
                $nameAndPhoneCount++;
            }

            $row['validation_status'] = 'valid_new';
            $row['action_recommended'] = 'import';
            $analyzedRows[] = $row;
        }

        return [
            'summary' => [
                'total_rows' => $totalRows,
                'valid_count' => $validCount,
                'name_and_phone_count' => $nameAndPhoneCount,
                'phone_only_count' => $phoneOnlyCount,
                'invalid_count' => $invalidCount,
                'duplicate_in_file_count' => $duplicateInFileCount,
                'duplicate_in_crm_count' => $duplicateInCrmCount,
                'uncertain_ocr_count' => $uncertainOcrCount,
                'suppressed_count' => $suppressedCount,
                'eligible_import_count' => $validCount,
            ],
            'rows' => $analyzedRows,
        ];
    }

    /**
     * Execute Import with Transaction and Non-Destructive Deduplication.
     *
     * @param  array<string, mixed>  $previewResult  Output of previewAndValidate()
     * @param  array<string, mixed>  $options
     * @return LeadImportBatch
     */
    public function createPreview(array $rows, User $user): LeadImportPreview
    {
        if (! $user->can('leads.import')) {
            throw ApiException::forbidden();
        }
        $payload = $this->previewAndValidate($this->normalizeRows($rows));

        return LeadImportPreview::create([
            'uploaded_by_id' => $user->id, 'payload' => $payload,
            'source_hash' => hash('sha256', json_encode($payload['rows'], JSON_THROW_ON_ERROR)),
            'expires_at' => now()->addMinutes(30),
        ]);
    }

    public function commitPreview(string $id, array $options, User $user): LeadImportBatch
    {
        if (! $user->can('leads.import')) {
            throw ApiException::forbidden();
        }

        return DB::transaction(function () use ($id, $options, $user) {
            $preview = LeadImportPreview::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($preview->uploaded_by_id !== $user->id) {
                throw ApiException::forbidden();
            }
            if ($preview->lead_import_batch_id) {
                return LeadImportBatch::findOrFail($preview->lead_import_batch_id);
            }
            if ($preview->expires_at->isPast()) {
                throw ApiException::unprocessable('PREVIEW_EXPIRED', 'Preview expired. Upload and review the file again.');
            }
            $batch = $this->executeImport($preview->payload, $options, $user);
            $preview->update(['lead_import_batch_id' => $batch->id]);

            return $batch;
        });
    }

    private function normalizeRows(array $rows): array
    {
        if (count($rows) > 500) {
            throw ValidationException::withMessages(['file' => 'Use the queued CSV importer for more than 500 rows.']);
        }

        return array_map(function (array $row, int $index): array {
            $normalized = $this->finalizeRow([
                'mobile' => $row['raw_mobile'] ?? $row['mobile_e164'] ?? $row['mobile'] ?? '',
                'full_name' => $row['full_name'] ?? 'Unnamed Lead',
                'email' => $row['email'] ?? null, 'city' => $row['city'] ?? null, 'state' => $row['state'] ?? null,
            ], $index + 1);
            $normalized['uncertain_ocr'] = (bool) ($row['uncertain_ocr'] ?? false);
            $invalid = Validator::make($normalized, [
                'full_name' => 'required|string|max:120', 'email' => 'nullable|email|max:255',
                'city' => 'nullable|string|max:80', 'state' => 'nullable|string|max:80',
            ]);
            if ($invalid->fails()) {
                $normalized['is_valid'] = false;
                $normalized['error_reason'] = $invalid->errors()->first();
            }

            return $normalized;
        }, array_values($rows), array_keys(array_values($rows)));
    }

    private function validateOptions(array $options, User $user): array
    {
        $validated = Validator::make($options, [
            'consent_basis' => 'required|string|min:10|max:1000',
            'consent_whatsapp' => 'sometimes|boolean', 'consent_calls' => 'sometimes|boolean',
            'vendor_id' => 'nullable|integer|exists:vendors,id', 'campaign_id' => 'nullable|integer|exists:campaigns,id',
            'assign_to_employee_id' => 'nullable|integer|exists:employees,id',
            'duplicate_strategy' => 'sometimes|in:skip,update_empty_fields',
            'original_filename' => 'nullable|string|max:255', 'import_format' => 'nullable|string|max:48',
        ])->validate();
        if ($id = ($validated['assign_to_employee_id'] ?? null)) {
            if (! $user->can('leads.assign') || ! app(LeadAssignmentService::class)->assignableEmployees($user)->contains('id', $id)) {
                throw ApiException::forbidden('You cannot assign leads to that employee.');
            }
        }

        return $validated;
    }

    public function executeImport(array $previewResult, array $options, User $user): LeadImportBatch
    {
        if (! $user->can('leads.import')) {
            throw ApiException::forbidden();
        }
        $options = $this->validateOptions($options, $user);

        return Cache::lock('crm:universal-lead-import', 120)->block(10, function () use ($previewResult, $options, $user) {
            return DB::transaction(function () use ($previewResult, $options, $user) {
                // Never trust submitted summary, validity flags, suppression or existing IDs.
                $previewResult = $this->previewAndValidate($this->normalizeRows($previewResult['rows'] ?? []));
                $summary = $previewResult['summary'];
                $rows = $previewResult['rows'];

                $vendorId = $options['vendor_id'] ?? null;
                $campaignId = $options['campaign_id'] ?? null;
                $consentBasis = $options['consent_basis'] ?? 'Direct Upload';
                $consentWhatsapp = (bool) ($options['consent_whatsapp'] ?? false);
                $consentCalls = (bool) ($options['consent_calls'] ?? false);
                $duplicateStrategy = $options['duplicate_strategy'] ?? 'skip'; // 'skip' | 'update_empty_fields'
                $assignEmployeeId = $options['assign_to_employee_id'] ?? null;

                // 1. Create LeadImportBatch record
                $batch = LeadImportBatch::create([
                    'original_filename' => $options['original_filename'] ?? 'Universal_Import_'.date('Ymd_His'),
                    'import_format' => $options['import_format'] ?? 'auto_detected',
                    'vendor_id' => $vendorId,
                    'campaign_id' => $campaignId,
                    'uploaded_by_id' => $user->id,
                    'total_rows' => $summary['total_rows'],
                    'valid_count' => $summary['valid_count'],
                    'name_and_phone_count' => $summary['name_and_phone_count'],
                    'phone_only_count' => $summary['phone_only_count'],
                    'duplicate_count' => $summary['duplicate_in_crm_count'] + $summary['duplicate_in_file_count'],
                    'invalid_count' => $summary['invalid_count'],
                    'uncertain_ocr_count' => $summary['uncertain_ocr_count'],
                    'consent_verified_count' => $consentWhatsapp ? $summary['valid_count'] : 0,
                    'consent_basis' => $consentBasis,
                    'consent_whatsapp' => $consentWhatsapp,
                    'consent_calls' => $consentCalls,
                    'status' => 'completed',
                ]);

                $acceptedCount = 0;
                $leadSourceId = LeadSource::query()->where('code', $vendorId ? 'vendor_feed' : 'bulk_import')->value('id')
                    ?? LeadSource::query()->first()?->id;

                $consents = app(ConsentRecorder::class);

                foreach ($rows as $row) {
                    $status = $row['validation_status'];
                    $mobile = $row['mobile_e164'] ?? null;
                    $name = $row['full_name'] ?? 'Unnamed Lead';

                    // Handle Duplicates in CRM
                    if ($status === 'duplicate_in_crm') {
                        if ($duplicateStrategy === 'update_empty_fields' && ! empty($row['existing_lead_id'])) {
                            $existing = Lead::find($row['existing_lead_id']);
                            if ($existing && $user->can('update', $existing)) {
                                $updates = [];
                                if ($existing->full_name === 'Unnamed Lead' && $name !== 'Unnamed Lead') {
                                    $updates['full_name'] = $name;
                                }
                                if (empty($existing->city) && ! empty($row['city'])) {
                                    $updates['city'] = $row['city'];
                                }
                                if (empty($existing->email) && ! empty($row['email'])) {
                                    $updates['email'] = $row['email'];
                                }
                                if (! empty($updates)) {
                                    $existing->update($updates);
                                    LeadActivity::create([
                                        'lead_id' => $existing->id,
                                        'type' => 'status_changed',
                                        'actor_user_id' => $user->id,
                                        'summary' => 'Enriched missing fields via Batch '.$batch->batch_code,
                                        'details' => $updates,
                                        'occurred_at' => now(),
                                    ]);
                                }
                            }
                        }

                        continue;
                    }

                    // Skip Invalids, Suppressed, or In-File Duplicates
                    if ($status !== 'valid_new') {
                        continue;
                    }

                    // Determine Initial Communication State
                    $commState = 'CONSENT_UNKNOWN';
                    if ($consentWhatsapp && $consentCalls) {
                        $commState = 'CONSENT_VERIFIED';
                    } elseif ($consentWhatsapp) {
                        $commState = 'ELIGIBLE_WHATSAPP';
                    } elseif ($consentCalls) {
                        $commState = 'ELIGIBLE_PHONE';
                    }

                    // Calculate preliminary AI score based on data completeness
                    $initialScore = 15;
                    if ($name !== 'Unnamed Lead') {
                        $initialScore += 10;
                    }
                    if (! empty($row['email'])) {
                        $initialScore += 10;
                    }
                    if (! empty($row['city'])) {
                        $initialScore += 5;
                    }
                    if ($consentWhatsapp) {
                        $initialScore += 10;
                    }

                    // Create Lead
                    $lead = Lead::create([
                        'full_name' => $name,
                        'mobile' => $mobile,
                        'email' => $row['email'] ?? null,
                        'city' => $row['city'] ?? null,
                        'state' => $row['state'] ?? null,
                        'country' => 'India',
                        'status' => 'NEW',
                        'communication_state' => $commState,
                        'ai_score' => $initialScore,
                        'ai_grade' => $initialScore >= 40 ? 'WARM' : 'COLD',
                        'lead_score_explanation' => 'Initial score assigned on import based on profile completeness and verified consent.',
                        'preferred_language' => $row['preferred_language'] ?? 'en',
                        'lead_source_id' => $leadSourceId,
                        'vendor_id' => $vendorId,
                        'campaign_id' => $campaignId,
                        'lead_import_batch_id' => $batch->id,
                        'assigned_employee_id' => $assignEmployeeId,
                        'assigned_at' => $assignEmployeeId ? now() : null,
                        'message' => $row['notes'] ?? null,
                    ]);

                    // Record Attribution
                    LeadAttribution::create([
                        'lead_id' => $lead->id,
                        'is_first_touch' => true,
                        'form_key' => 'universal_import',
                        'vendor_code' => $batch->vendor?->code,
                        'utm_campaign' => $batch->campaign?->code,
                        'captured_at' => now(),
                    ]);

                    // Record Timeline Activity
                    LeadActivity::create([
                        'lead_id' => $lead->id,
                        'type' => 'imported',
                        'actor_user_id' => $user->id,
                        'summary' => 'Imported via Batch '.$batch->batch_code.' ('.$batch->original_filename.')',
                        'details' => [
                            'batch_id' => $batch->id,
                            'batch_code' => $batch->batch_code,
                            'phone_only' => ! empty($row['phone_only']),
                        ],
                        'occurred_at' => now(),
                    ]);

                    // Record Lifecycle History
                    LeadStatusHistory::create([
                        'lead_id' => $lead->id,
                        'from_status' => null,
                        'to_status' => 'NEW',
                        'changed_by' => $user->id,
                        'reason' => 'Ingested via Universal Lead Importer (Batch '.$batch->batch_code.')',
                    ]);

                    // Record Statutory Consent Evidence
                    $consents->record('lead', $lead->id, 'data_processing', true, 'import', $consentBasis);
                    $consents->record('lead', $lead->id, 'calls', $consentCalls, 'import', $consentBasis);
                    $consents->record('lead', $lead->id, 'whatsapp', $consentWhatsapp, 'import', $consentBasis);

                    // Auto-assignment if no manual employee specified
                    if (! $assignEmployeeId) {
                        try {
                            app(LeadAssignmentService::class)->autoAssign($lead);
                        } catch (\Throwable $e) {
                            Log::warning('[UniversalLeadImporter] Auto-assign fallback:', ['error' => $e->getMessage()]);
                        }
                    }

                    // Trigger CRM Automation Workflow (Scoring & Initial Automated Nurturing)
                    try {
                        app(AutomationWorkflowEngine::class)->triggerWorkflow($lead, 'WORKFLOW_A_NEW_IMPORT');
                    } catch (\Throwable $e) {
                        Log::warning('[UniversalLeadImporter] Automation trigger failed:', ['lead_id' => $lead->id, 'error' => $e->getMessage()]);
                    }

                    $acceptedCount++;
                }

                $batch->update(['accepted_count' => $acceptedCount]);

                // Audit Log
                app(AuditLogger::class)->record('lead_batch.imported', $batch, new: [
                    'batch_code' => $batch->batch_code,
                    'accepted' => $acceptedCount,
                    'total' => $summary['total_rows'],
                ], actor: $user);

                return $batch;
            });
        });
    }

    /**
     * Generate downloadable CSV validation report.
     *
     * @param  array<int, array<string, mixed>>|LeadImportBatch  $source
     * @return string CSV text
     */
    public function generateValidationReportCsv(array|LeadImportBatch $source): string
    {
        $fp = fopen('php://temp', 'r+');

        if ($source instanceof LeadImportBatch) {
            $this->writeCsvRow($fp, ['Lead ID', 'Full Name', 'Mobile', 'Email', 'City', 'Status', 'Communication State', 'AI Score', 'AI Grade', 'Created At']);
            $leads = $source->leads()->get();
            foreach ($leads as $l) {
                $this->writeCsvRow($fp, [
                    $l->id,
                    $l->full_name,
                    $l->mobile,
                    $l->email ?? '',
                    $l->city ?? '',
                    $l->status,
                    $l->communication_state,
                    $l->ai_score,
                    $l->ai_grade,
                    $l->created_at?->toIso8601String(),
                ]);
            }
        } else {
            $this->writeCsvRow($fp, ['Row Number', 'Full Name', 'Raw Phone', 'Normalized E164', 'Validation Status', 'Action Recommended', 'Reason / Error']);
            foreach ($source as $r) {
                $this->writeCsvRow($fp, [
                    $r['row_number'] ?? '',
                    $r['full_name'] ?? 'Unnamed Lead',
                    $r['raw_mobile'] ?? '',
                    $r['mobile_e164'] ?? '',
                    $r['validation_status'] ?? '',
                    $r['action_recommended'] ?? '',
                    $r['error_reason'] ?? 'Accepted',
                ]);
            }
        }

        rewind($fp);
        $csvContent = stream_get_contents($fp);
        fclose($fp);

        return $csvContent ?: '';
    }

    private function writeCsvRow($stream, array $values): void
    {
        fputcsv($stream, array_map(fn ($value) => is_string($value) && preg_match('/^[\s]*[=+@-]/', $value) ? "'".$value : $value, $values), ',', '"', '');
    }

    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------

    private function isVerticalKvStructure(array $lines): bool
    {
        $kvMatches = 0;
        $maxSample = min(15, count($lines));

        for ($i = 0; $i < $maxSample; $i++) {
            $line = $lines[$i];
            if (preg_match('/["\']?(fullName|name|mobile|phone|contact|email)["\']?\s*[,:\t|]/i', $line)) {
                $kvMatches++;
            }
        }

        return $kvMatches >= 2;
    }

    private function parseVerticalKvLines(array $lines): array
    {
        $leads = [];
        $currentLead = [];
        $rowCounter = 1;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            $parts = preg_split('/[,:\t|]/', $line, 2);
            if (count($parts) < 2) {
                continue;
            }

            $key = strtolower(trim(str_replace(['"', "'"], '', $parts[0])));
            $val = trim(str_replace(['"', "'", ','], '', $parts[1]));

            $normKey = null;
            if (str_contains($key, 'fullname') || str_contains($key, 'name')) {
                $normKey = 'full_name';
            } elseif (str_contains($key, 'mobile') || str_contains($key, 'phone') || str_contains($key, 'contact')) {
                $normKey = 'mobile';
            } elseif (str_contains($key, 'email')) {
                $normKey = 'email';
            } elseif (str_contains($key, 'city') || str_contains($key, 'location')) {
                $normKey = 'city';
            }

            if (! $normKey) {
                continue;
            }

            // When a key repeats (e.g. new "fullName"), flush buffer into new lead
            if (isset($currentLead[$normKey])) {
                $leads[] = $this->finalizeRow($currentLead, $rowCounter++);
                $currentLead = [];
            }
            $currentLead[$normKey] = $val;
        }

        if (! empty($currentLead)) {
            $leads[] = $this->finalizeRow($currentLead, $rowCounter++);
        }

        return $leads;
    }

    private function splitLine(string $line): array
    {
        // Try tab, pipe, comma, or dash
        if (str_contains($line, "\t")) {
            return array_map('trim', explode("\t", $line));
        }
        if (str_contains($line, '|')) {
            return array_map('trim', explode('|', $line));
        }
        if (str_contains($line, '—')) {
            return array_map('trim', explode('—', $line));
        }
        if (str_contains($line, ',')) {
            return str_getcsv($line);
        }

        return [trim($line)];
    }

    private function detectHeaderColumns(array $parts): array
    {
        $map = [];
        foreach ($parts as $idx => $p) {
            $clean = str_replace('_', ' ', strtolower(trim(ltrim($p, "\xEF\xBB\xBF"))));
            if (in_array($clean, ['mobile', 'phone', 'contact', 'number', 'whatsapp', 'telephone', 'mobile number', 'phone number'])) {
                $map['mobile'] = $idx;
            } elseif (in_array($clean, ['name', 'full name', 'customer name', 'client name', 'fullname'])) {
                $map['name'] = $idx;
            } elseif (in_array($clean, ['email', 'email address'])) {
                $map['email'] = $idx;
            } elseif (in_array($clean, ['city', 'location'])) {
                $map['city'] = $idx;
            } elseif (in_array($clean, ['state'])) {
                $map['state'] = $idx;
            }
        }

        return $map;
    }

    private function mapRowUsingHeader(array $parts, array $headerMap, int $rowNum): ?array
    {
        $data = [
            'row_number' => $rowNum,
            'full_name' => isset($headerMap['name']) ? trim($parts[$headerMap['name']] ?? '') : 'Unnamed Lead',
            'mobile' => isset($headerMap['mobile']) ? trim($parts[$headerMap['mobile']] ?? '') : '',
            'email' => isset($headerMap['email']) ? trim($parts[$headerMap['email']] ?? '') : null,
            'city' => isset($headerMap['city']) ? trim($parts[$headerMap['city']] ?? '') : null,
            'state' => isset($headerMap['state']) ? trim($parts[$headerMap['state']] ?? '') : null,
        ];

        return $this->finalizeRow($data, $rowNum);
    }

    private function inferRowStructure(array $parts, int $rowNum): ?array
    {
        $count = count($parts);

        // Format 1: Single column mobile number (Image 2)
        if ($count === 1) {
            return $this->finalizeRow([
                'full_name' => 'Unnamed Lead',
                'mobile' => $parts[0],
                'phone_only' => true,
            ], $rowNum);
        }

        // Format 2: Two columns Name | Mobile (Image 1)
        if ($count === 2) {
            $p0 = $parts[0];
            $p1 = $parts[1];

            // Determine which is mobile
            $p0Digits = preg_replace('/\D/', '', $p0);
            $p1Digits = preg_replace('/\D/', '', $p1);

            if (strlen($p1Digits) >= 10 && strlen($p0Digits) < 10) {
                // Name is col 0, Phone is col 1 (Standard Image 1)
                return $this->finalizeRow([
                    'full_name' => $p0,
                    'mobile' => $p1,
                ], $rowNum);
            } elseif (strlen($p0Digits) >= 10 && strlen($p1Digits) < 10) {
                // Phone is col 0, Name is col 1
                return $this->finalizeRow([
                    'full_name' => $p1,
                    'mobile' => $p0,
                ], $rowNum);
            }

            // Fallback: col 0 name, col 1 mobile
            return $this->finalizeRow([
                'full_name' => $p0,
                'mobile' => $p1,
            ], $rowNum);
        }

        // Multi-column table
        $phoneIdx = null;
        $nameIdx = null;

        foreach ($parts as $idx => $part) {
            $digits = preg_replace('/\D/', '', $part);
            if (strlen($digits) >= 10 && preg_match('/^[6-9]/', $digits)) {
                $phoneIdx = $idx;
                break;
            }
        }

        $name = 'Unnamed Lead';
        if ($phoneIdx !== null) {
            $nameIdx = $phoneIdx === 0 ? 1 : 0;
            $name = $parts[$nameIdx] ?? 'Unnamed Lead';
        }

        return $this->finalizeRow([
            'full_name' => $name,
            'mobile' => $phoneIdx !== null ? $parts[$phoneIdx] : ($parts[1] ?? ''),
            'email' => $parts[2] ?? null,
            'city' => $parts[3] ?? null,
        ], $rowNum);
    }

    private function finalizeRow(array $data, int $rowNum): array
    {
        $rawMobile = (string) ($data['mobile'] ?? '');
        $name = trim((string) ($data['full_name'] ?? ''));

        if ($name === '' || preg_match('/^\d+$/', $name)) {
            $name = 'Unnamed Lead';
            $data['phone_only'] = true;
        }

        $mobileE164 = PhoneNormalizer::toE164($rawMobile);
        $isValid = $mobileE164 !== null;

        return [
            'row_number' => $rowNum,
            'full_name' => $name,
            'raw_mobile' => $rawMobile,
            'mobile_e164' => $mobileE164,
            'email' => ! empty($data['email']) ? mb_strtolower(trim($data['email'])) : null,
            'city' => ! empty($data['city']) ? trim($data['city']) : null,
            'state' => ! empty($data['state']) ? trim($data['state']) : null,
            'phone_only' => ! empty($data['phone_only']) || $name === 'Unnamed Lead',
            'is_valid' => $isValid,
            'error_reason' => $isValid ? null : 'Invalid phone number format or length',
            'uncertain_ocr' => false,
        ];
    }

    private function parseCsvFile(string $filePath): array
    {
        $reader = new CsvReader;
        $reader->open($filePath);

        $parsed = [];
        $headerMap = [];
        $rowNum = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $cells = array_map(fn ($c) => trim((string) $c), $row->toArray());
                if (empty(array_filter($cells))) {
                    continue;
                }

                $rowNum++;
                if ($rowNum > 501) {
                    throw ValidationException::withMessages(['file' => 'Use the queued CSV importer for more than 500 rows.']);
                }
                if ($rowNum === 1) {
                    $headerMap = $this->detectHeaderColumns($cells);
                    if (isset($headerMap['mobile']) || isset($headerMap['name'])) {
                        continue;
                    }
                }

                if (! empty($headerMap)) {
                    $p = $this->mapRowUsingHeader($cells, $headerMap, $rowNum);
                } else {
                    $p = $this->inferRowStructure($cells, $rowNum);
                }

                if ($p !== null) {
                    $parsed[] = $p;
                }
            }
        }

        $reader->close();

        return $parsed;
    }

    private function parseXlsxFile(string $filePath): array
    {
        $reader = new XlsxReader;
        $reader->open($filePath);

        $parsed = [];
        $headerMap = [];
        $rowNum = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $cells = array_map(fn ($c) => trim((string) $c), $row->toArray());
                if (empty(array_filter($cells))) {
                    continue;
                }

                $rowNum++;
                if ($rowNum > 501) {
                    throw ValidationException::withMessages(['file' => 'Use the queued CSV importer for more than 500 rows.']);
                }
                if ($rowNum === 1) {
                    $headerMap = $this->detectHeaderColumns($cells);
                    if (isset($headerMap['mobile']) || isset($headerMap['name'])) {
                        continue;
                    }
                }

                if (! empty($headerMap)) {
                    $p = $this->mapRowUsingHeader($cells, $headerMap, $rowNum);
                } else {
                    $p = $this->inferRowStructure($cells, $rowNum);
                }

                if ($p !== null) {
                    $parsed[] = $p;
                }
            }
        }

        $reader->close();

        return $parsed;
    }
}
