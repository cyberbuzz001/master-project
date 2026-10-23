<?php

namespace App\Filament\Resources\LeadImportBatches;

use App\Domain\Crm\UniversalLeadImporter;
use App\Filament\Resources\LeadImportBatches\Pages\ManageLeadImportBatches;
use App\Models\Campaign;
use App\Models\LeadImportBatch;
use App\Models\Vendor;
use BackedEnum;
use Filament\Actions\Action;
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
            ->with(['vendor:id,name', 'campaign:id,name', 'uploader:id,name']);
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
                TextColumn::make('detected_format')
                    ->label('Detected Format')
                    ->badge()
                    ->color('info')
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'vertical_kv' => 'Vertical Key-Value',
                        'single_column_phone' => 'Phone Numbers Only',
                        'two_column_name_phone' => 'Name | Mobile',
                        'multi_column_table' => 'Tabular / SpreadSheet',
                        'vision_ocr_extracted' => 'Vision OCR Extracted',
                        default => $state,
                    }),
                TextColumn::make('total_rows_detected')->label('Total Rows')->numeric()->sortable(),
                TextColumn::make('accepted_count')->label('Accepted')->numeric()->color('success')->sortable(),
                TextColumn::make('rejected_count')->label('Rejected')->numeric()->color('danger')->sortable(),
                TextColumn::make('duplicate_in_file_count')->label('File Dupes')->numeric()->color('warning')->toggleable(),
                TextColumn::make('duplicate_in_crm_count')->label('CRM Dupes')->numeric()->color('warning')->toggleable(),
                TextColumn::make('vendor.name')->label('Vendor')->placeholder('Direct / Organic')->toggleable(),
                TextColumn::make('campaign.name')->label('Campaign')->placeholder('None')->toggleable(),
                TextColumn::make('uploader.name')->label('Uploaded By')->toggleable(),
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
                Action::make('universalBulkImport')
                    ->label('Bulk Lead Import Center')
                    ->icon(Heroicon::OutlinedSparkles)
                    ->color('primary')
                    ->modalHeading('Universal Bulk Lead Importer')
                    ->modalDescription('Supports XLSX, CSV, TXT, Raw Number/Name lists, and Screenshot Vision Extractions.')
                    ->schema([
                        FileUpload::make('file')
                            ->label('Upload File / Screenshot')
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
                            ]),
                        Textarea::make('raw_text')
                            ->label('Or Paste Raw Phone Numbers / Names')
                            ->placeholder("9876543210\nRahul Sharma — 9123456780\n\"fullName\": \"Attada Prasad\", \"mobile\": \"9912829401\"")
                            ->rows(5),
                        Select::make('vendor_id')
                            ->label('Lead Vendor / Data Source')
                            ->options(fn () => Vendor::pluck('name', 'id'))
                            ->searchable(),
                        Select::make('campaign_id')
                            ->label('Marketing Campaign')
                            ->options(fn () => Campaign::pluck('name', 'id'))
                            ->searchable(),
                        TextInput::make('consent_basis')
                            ->label('Statutory Consent Basis / Version')
                            ->placeholder('Website opt-in / Ad form submit (Mandatory for WhatsApp)')
                            ->maxLength(255),
                    ])
                    ->action(function (array $data) {
                        $importer = app(UniversalLeadImporter::class);

                        $filePath = null;
                        $originalName = 'Pasted Text';
                        $mimeType = 'text/plain';

                        if (!empty($data['file'])) {
                            $filePath = Storage::disk('local')->path($data['file']);
                            $originalName = basename($filePath);
                            $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';
                        }

                        $preview = $importer->previewAndValidate(
                            filePath: $filePath,
                            rawText: $data['raw_text'] ?? null,
                            originalFilename: $originalName,
                            mimeType: $mimeType
                        );

                        if ($preview['total_rows_detected'] === 0) {
                            Notification::make()
                                ->title('Import Failed')
                                ->body('No valid records could be detected in the provided file/text.')
                                ->danger()
                                ->send();
                            return;
                        }

                        $batch = $importer->executeImport(
                            previewData: $preview,
                            uploaderId: auth()->id(),
                            vendorId: $data['vendor_id'] ? (int) $data['vendor_id'] : null,
                            campaignId: $data['campaign_id'] ? (int) $data['campaign_id'] : null,
                            consentBasis: $data['consent_basis'] ?? null
                        );

                        Notification::make()
                            ->title("Import Completed: Batch {$batch->batch_code}")
                            ->body("Accepted: {$batch->accepted_count} | Duplicates: " . ($batch->duplicate_in_file_count + $batch->duplicate_in_crm_count) . " | Format: {$batch->detected_format}")
                            ->success()
                            ->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageLeadImportBatches::route('/'),
        ];
    }
}
