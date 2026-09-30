<?php

namespace App\Filament\Resources\Clients\RelationManagers;

use App\Domain\Onboarding\DocumentVault;
use App\Filament\Support\DomainAction;
use App\Models\Document;
use Filament\Actions\Action;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class DocumentsRelationManager extends RelationManager
{
    protected static string $relationship = 'documents';

    protected static ?string $title = 'Documents';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedFolder;

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()->can('viewKyc', $ownerRecord);
    }

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $vault = app(DocumentVault::class);

        return $table
            ->description('Files are encrypted at rest and only reachable through a short-lived link. Every view and download is logged.')
            ->columns([
                TextColumn::make('title')->searchable()
                    ->description(fn (Document $record) => config("onboarding.documents.categories.{$record->category}", $record->category)),
                TextColumn::make('versions_count')->label('Versions')->state(fn (Document $record) => $record->versions()->count()),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    Document::VERIFIED => 'success',
                    Document::REJECTED => 'danger',
                    Document::EXPIRED => 'gray',
                    default => 'warning',
                }),
                TextColumn::make('rejection_reason')->label('Note')->wrap()->placeholder('—')->toggleable(),
                TextColumn::make('created_at')->label('Uploaded')->dateTime('d M Y, h:i A', $tz),
                TextColumn::make('retain_until')->label('Retain until')->date('M Y', $tz)->placeholder('—')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                Action::make('uploadDocument')
                    ->label('Upload')
                    ->icon(Heroicon::OutlinedArrowUpTray)
                    ->visible(fn () => auth()->user()->can('uploadDocuments', $this->getOwnerRecord()))
                    ->schema([
                        Select::make('category')->options(config('onboarding.documents.categories'))->required()->native(false),
                        FileUpload::make('file')
                            ->label('File')
                            ->required()
                            ->storeFiles(false)
                            ->acceptedFileTypes(config('onboarding.documents.allowed_mimes'))
                            ->maxSize((int) config('onboarding.documents.max_size_kb'))
                            ->helperText('PDF or image. Stored encrypted; every download is logged.'),
                    ])
                    ->action(fn (array $data, Action $action) => DomainAction::run($action, fn () => app(DocumentVault::class)->store(
                        auth()->user(),
                        'client',
                        $this->getOwnerRecord()->id,
                        $data['category'],
                        $data['file'],
                        ['is_demo' => (bool) $this->getOwnerRecord()->is_demo],
                    ), 'Document uploaded')),
            ])
            ->recordActions([
                Action::make('download')
                    ->icon(Heroicon::OutlinedArrowDownTray)
                    ->visible(fn (Document $record) => auth()->user()->can('documents.download') && $record->currentVersion() !== null)
                    ->url(fn (Document $record) => $vault->temporaryUrl(auth()->user(), $record))
                    ->openUrlInNewTab(),
                Action::make('verify')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (Document $record) => auth()->user()->can('kyc.verify') && $record->status !== Document::VERIFIED)
                    ->action(fn (Document $record, Action $action) => DomainAction::run($action, fn () => $vault->verify(auth()->user(), $record), 'Document verified')),
                Action::make('reject')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('danger')
                    ->visible(fn (Document $record) => auth()->user()->can('kyc.verify') && $record->status !== Document::REJECTED)
                    ->schema([Textarea::make('reason')->label('What is wrong?')->required()->rows(2)->maxLength(1000)])
                    ->action(fn (array $data, Document $record, Action $action) => DomainAction::run($action, fn () => $vault->reject(auth()->user(), $record, $data['reason']), 'Document rejected')),
                Action::make('accessLog')
                    ->label('Access log')
                    ->icon(Heroicon::OutlinedEye)
                    ->color('gray')
                    ->visible(fn () => auth()->user()->can('audit.view'))
                    ->modalSubmitAction(false)
                    ->modalContent(fn (Document $record) => view('filament.clients.document-access', ['document' => $record])),
            ]);
    }
}
