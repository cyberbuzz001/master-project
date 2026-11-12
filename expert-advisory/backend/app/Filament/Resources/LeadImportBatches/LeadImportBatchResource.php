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
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Components\Wizard\Step;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
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
        $query = parent::getEloquentQuery()->with(['vendor:id,name', 'campaign:id,name', 'uploadedBy:id,name']);

        return auth()->user()->can('leads.view_all') ? $query : $query->where('uploaded_by_id', auth()->id());
    }

    public static function canViewAny(): bool
    {
        return auth()->user()->can('leads.import');
    }

    public static function canCreate(): bool
    {
        return false;
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
                        Gate::authorize('view', $record);
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
            ->visible(fn (): bool => auth()->user()->can('leads.import'))
            ->icon(Heroicon::OutlinedCloudArrowUp)
            ->modalWidth('2xl')
            ->steps([
                Step::make('Source')->schema([
                    Hidden::make('preview_id'),
                    Hidden::make('preview_summary'),
                    FileUpload::make('file')->label('CSV, TXT, XLSX or screenshot')
                        ->disk('local')->directory(fn (): string => 'lead_imports_temp/'.auth()->id())
                        ->visibility('private')->maxSize(4096)
                        ->acceptedFileTypes(['text/csv', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/webp']),
                    Textarea::make('raw_text')->label('Or paste contacts')->rows(6)->maxLength(100000),
                ])->afterValidation(function (Get $get, Set $set): void {
                    Gate::authorize('leads.import');
                    $importer = app(UniversalLeadImporter::class);
                    $rows = [];
                    if ($file = $get('file')) {
                        $prefix = 'lead_imports_temp/'.auth()->id().'/';
                        if (! str_starts_with($file, $prefix) || ! preg_match('/^[a-zA-Z0-9._-]+$/', substr($file, strlen($prefix)))) {
                            throw ValidationException::withMessages(['file' => 'Invalid upload reference.']);
                        }
                        $path = Storage::disk('local')->path($file);
                        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                        $rows = in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)
                            ? $importer->parseImageScreenshot($path)
                            : $importer->parseSpreadsheetFile($path, $ext);
                    }
                    if ($text = $get('raw_text')) {
                        $rows = array_merge($rows, $importer->parseRawText($text));
                    }
                    if (! $rows) {
                        throw ValidationException::withMessages(['raw_text' => 'Upload a file or paste contacts before continuing.']);
                    }
                    $preview = $importer->createPreview($rows, auth()->user());
                    $summary = $preview->payload['summary'];
                    $details = ['Total: '.$summary['total_rows'], 'Eligible: '.$summary['eligible_import_count'],
                        'Duplicates: '.($summary['duplicate_in_file_count'] + $summary['duplicate_in_crm_count']),
                        'Invalid: '.$summary['invalid_count'], 'Suppressed: '.$summary['suppressed_count']];
                    foreach (array_slice($preview->payload['rows'], 0, 25) as $row) {
                        if ($row['validation_status'] !== 'valid_new') {
                            $details[] = 'Row '.$row['row_number'].': '.$row['validation_status'].' — '.($row['error_reason'] ?? '');
                        }
                    }
                    $set('preview_id', $preview->id);
                    $set('preview_summary', implode("\n", $details));
                }),
                Step::make('Review & confirm')->schema([
                    Textarea::make('preview_display')->formatStateUsing(fn (Get $get) => $get('preview_summary'))->label('Validation preview')->rows(10)->disabled()->dehydrated(false),
                    Select::make('vendor_id')->label('Vendor')->options(fn () => Vendor::query()->where('status', 'active')->pluck('name', 'id'))->searchable(),
                    Select::make('campaign_id')->label('Campaign')->options(fn () => Campaign::pluck('name', 'id'))->searchable(),
                    Select::make('assign_to_employee_id')->label('Assign to')->visible(fn (): bool => auth()->user()->can('leads.assign'))
                        ->options(fn () => app(LeadAssignmentService::class)->assignableEmployees(auth()->user())->mapWithKeys(fn (Employee $employee) => [$employee->id => $employee->displayName()]))->searchable(),
                    Textarea::make('consent_basis')->label('Source and consent evidence')->required()->minLength(10)->maxLength(1000),
                    Checkbox::make('consent_whatsapp')->label('Explicit WhatsApp opt-in is documented')->default(false),
                    Checkbox::make('consent_calls')->label('Explicit call opt-in is documented')->default(false),
                ]),
            ])->action(function (array $data): void {
                $batch = app(UniversalLeadImporter::class)->commitPreview($data['preview_id'], [
                    'original_filename' => 'Staff upload', 'import_format' => 'universal',
                    'consent_basis' => $data['consent_basis'], 'consent_whatsapp' => (bool) ($data['consent_whatsapp'] ?? false),
                    'consent_calls' => (bool) ($data['consent_calls'] ?? false),
                    'vendor_id' => $data['vendor_id'] ?? null, 'campaign_id' => $data['campaign_id'] ?? null,
                    'assign_to_employee_id' => $data['assign_to_employee_id'] ?? null,
                ], auth()->user());
                Notification::make()->success()->title('Import completed: '.$batch->batch_code)
                    ->body('Accepted: '.$batch->accepted_count.' · Duplicates: '.$batch->duplicate_count.' · Invalid: '.$batch->invalid_count)->send();
            });
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageLeadImportBatches::route('/'),
        ];
    }
}
