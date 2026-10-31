<?php

namespace App\Filament\Resources\LeadImportBatches;

use App\Domain\Crm\LeadAssignmentService;
use App\Domain\Crm\UniversalLeadImporter;
use App\Filament\Resources\LeadImportBatches\Pages\ManageLeadImportBatches;
use App\Models\Campaign;
use App\Models\Employee;
use App\Models\LeadImportBatch;
use App\Models\Vendor;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Checkbox;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;
use UnitEnum;

class LeadImportBatchResource extends Resource
{
    protected static ?string $model = LeadImportBatch::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCloudArrowUp;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 4;

    protected static ?string $navigationLabel = 'AI Lead Importer';

    protected static ?string $modelLabel = 'Lead Import Batch';

    protected static ?string $slug = 'universal-lead-imports';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->with(['vendor:id,name', 'campaign:id,name', 'uploadedBy:id,name']);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('batch_code')
                    ->label('Batch Code')
                    ->weight('bold')
                    ->searchable()
                    ->description(fn (LeadImportBatch $record) => $record->original_filename),
                TextColumn::make('import_format')
                    ->label('Detected Format')
                    ->badge()
                    ->color('info')
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'vertical_kv' => 'Vertical Key-Value',
                        'single_column_phone', 'text_single_phone' => 'Phone Numbers Only',
                        'two_column_name_phone', 'text_name_phone' => 'Name | Mobile',
                        'multi_column_table', 'tabular' => 'Tabular Data',
                        'screenshot_ocr', 'vision_ocr_extracted' => 'Vision OCR Extracted',
                        'excel' => 'Excel Spreadsheet',
                        'csv' => 'CSV Document',
                        'text_raw' => 'Pasted Text/Numbers',
                        default => $state ? ucwords(str_replace('_', ' ', $state)) : 'Auto-detected',
                    }),
                TextColumn::make('total_rows')->label('Total Rows')->numeric()->sortable(),
                TextColumn::make('accepted_count')->label('Accepted')->numeric()->color('success')->sortable(),
                TextColumn::make('duplicate_count')->label('Duplicates')->numeric()->color('warning')->sortable(),
                TextColumn::make('invalid_count')->label('Invalid')->numeric()->color('danger')->sortable(),
                TextColumn::make('vendor.name')->label('Vendor')->placeholder('Direct / Organic')->toggleable(),
                TextColumn::make('campaign.name')->label('Campaign')->placeholder('None')->toggleable(),
                TextColumn::make('uploadedBy.name')->label('Uploaded By')->placeholder('System / API')->toggleable(),
                TextColumn::make('created_at')->label('Import Date')->dateTime('d M Y, h:i A', $tz)->sortable(),
            ])
            ->filters([
                SelectFilter::make('vendor_id')->label('Vendor')->options(fn () => Vendor::query()->orderBy('name')->pluck('name', 'id')),
                SelectFilter::make('campaign_id')->label('Campaign')->options(fn () => Campaign::query()->orderByDesc('id')->pluck('name', 'id')),
            ])
            ->recordActions([
                Action::make('downloadReport')
                    ->label('Validation Report')
                    ->icon(Heroicon::OutlinedDocumentArrowDown)
                    ->color('primary')
                    ->action(function (LeadImportBatch $record) {
                        $importer = app(UniversalLeadImporter::class);
                        $csvContent = $importer->generateValidationReportCsv($record);

                        return response()->streamDownload(function () use ($csvContent) {
                            echo $csvContent;
                        }, "validation_report_{$record->batch_code}.csv", [
                            'Content-Type' => 'text/csv',
                        ]);
                    }),
            ])
            ->headerActions([
                self::getUniversalImportAction(),
            ]);
    }

    public static function getUniversalImportAction(): Action
    {
        return Action::make('universalBulkImport')
            ->label('Bulk Upload & Paste Numbers')
            ->icon(Heroicon::OutlinedCloudArrowUp)
            ->color('primary')
            ->modalHeading('Universal Bulk Lead Importer (Excel, CSV, Raw Numbers, OCR)')
            ->modalDescription('Paste phone numbers / contacts directly or upload spreadsheets, CSVs, or OCR screenshots. Leads are automatically validated, deduplicated, scored, and enrolled into CRM automation.')
            ->modalWidth('2xl')
            ->schema([
                FileUpload::make('file')
                    ->label('Upload File (Excel .xlsx, CSV, TXT, or Screenshot Image)')
                    ->disk('local')
                    ->directory('lead_imports_temp')
                    ->acceptedFileTypes([
                        'text/csv',
                        'text/plain',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'image/png',
                        'image/jpeg',
                        'image/webp',
                    ])
                    ->helperText('Upload an Excel file (.xlsx, .xls), CSV file, or screenshot image.'),
                Textarea::make('raw_text')
                    ->label('Or Paste Numbers / Contacts in Bulk')
                    ->placeholder("Paste numbers here, for example:\n9876543210\n9123456780\nRahul Sharma — 9876543210\n\"fullName\": \"Attada Prasad\", \"mobile\": \"9912829401\"")
                    ->rows(6)
                    ->helperText('Accepts one phone number per line, comma-separated numbers, Name - Mobile, or JSON lines.'),
                Select::make('vendor_id')
                    ->label('Lead Vendor / Data Source')
                    ->options(fn () => Vendor::pluck('name', 'id'))
                    ->searchable()
                    ->placeholder('Direct / Organic Ingestion'),
                Select::make('campaign_id')
                    ->label('Marketing Campaign')
                    ->options(fn () => Campaign::pluck('name', 'id'))
                    ->searchable()
                    ->placeholder('None / General Campaign'),
                Select::make('assign_to_employee_id')
                    ->label('Assign All To (Optional)')
                    ->options(fn () => app(LeadAssignmentService::class)->assignableEmployees(auth()->user())->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                    ->searchable()
                    ->placeholder('Auto-Assign based on Round-Robin & Capacity')
                    ->visible(fn () => auth()->user()?->can('leads.assign')),
                TextInput::make('consent_basis')
                    ->label('Statutory Consent Basis / Source')
                    ->default('Direct Bulk Ingestion / Customer Inquiry')
                    ->placeholder('e.g. Website registration, ad inquiry, customer opt-in')
                    ->maxLength(255),
                Checkbox::make('consent_whatsapp')
                    ->label('Consent verified for WhatsApp outreach')
                    ->default(true),
                Checkbox::make('consent_calls')
                    ->label('Consent verified for phone calls')
                    ->default(true),
            ])
            ->action(function (array $data) {
                $importer = app(UniversalLeadImporter::class);

                $filePath = null;
                $originalName = 'Pasted Raw Numbers/Contacts';
                $importFormat = 'text_raw';
                $parsedRows = [];

                if (!empty($data['file'])) {
                    $filePath = Storage::disk('local')->path($data['file']);
                    $originalName = basename($filePath);
                    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

                    if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp'])) {
                        $parsedRows = $importer->parseImageScreenshot($filePath);
                        $importFormat = 'screenshot_ocr';
                    } else {
                        $parsedRows = $importer->parseSpreadsheetFile($filePath, $ext);
                        $importFormat = in_array($ext, ['xlsx', 'xls']) ? 'excel' : 'csv';
                    }
                }

                if (!empty($data['raw_text'])) {
                    $textRows = $importer->parseRawText($data['raw_text']);
                    $parsedRows = array_merge($parsedRows, $textRows);
                    if (empty($data['file'])) {
                        $importFormat = 'text_raw';
                    }
                }

                if (empty($parsedRows)) {
                    Notification::make()
                        ->title('Import Failed')
                        ->body('No valid phone numbers or records could be detected in the provided file/text.')
                        ->danger()
                        ->send();
                    return;
                }

                $vendorId = !empty($data['vendor_id']) ? (int) $data['vendor_id'] : null;
                $preview = $importer->previewAndValidate($parsedRows, $vendorId);

                if (($preview['summary']['total_rows'] ?? 0) === 0) {
                    Notification::make()
                        ->title('Import Failed')
                        ->body('No valid contact numbers could be found in the provided data.')
                        ->danger()
                        ->send();
                    return;
                }

                $batch = $importer->executeImport(
                    previewResult: $preview,
                    options: [
                        'original_filename' => $originalName,
                        'import_format' => $importFormat,
                        'vendor_id' => $vendorId,
                        'campaign_id' => !empty($data['campaign_id']) ? (int) $data['campaign_id'] : null,
                        'consent_basis' => !empty($data['consent_basis']) ? $data['consent_basis'] : 'Direct Bulk CRM Ingestion',
                        'consent_whatsapp' => (bool) ($data['consent_whatsapp'] ?? true),
                        'consent_calls' => (bool) ($data['consent_calls'] ?? true),
                        'assign_to_employee_id' => !empty($data['assign_to_employee_id']) ? (int) $data['assign_to_employee_id'] : null,
                    ],
                    user: auth()->user()
                );

                Notification::make()
                    ->title("Import Completed: Batch {$batch->batch_code}")
                    ->body("Accepted: {$batch->accepted_count} | Duplicates: {$batch->duplicate_count} | Invalid: {$batch->invalid_count} | Format: {$batch->import_format}")
                    ->success()
                    ->send();
            });
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageLeadImportBatches::route('/'),
        ];
    }
}
