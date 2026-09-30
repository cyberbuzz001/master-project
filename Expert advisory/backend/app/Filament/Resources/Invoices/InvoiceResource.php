<?php

namespace App\Filament\Resources\Invoices;

use App\Domain\Billing\BillingDocumentService;
use App\Domain\Billing\InvoiceService;
use App\Domain\Onboarding\DocumentVault;
use App\Filament\Resources\Clients\ClientResource;
use App\Filament\Resources\Invoices\Pages\ListInvoices;
use App\Filament\Resources\Invoices\Pages\ViewInvoice;
use App\Filament\Support\DomainAction;
use App\Models\Invoice;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class InvoiceResource extends Resource
{
    protected static ?string $model = Invoice::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentText;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'invoice_number';

    public const STATUS_COLORS = [
        Invoice::DRAFT => 'gray',
        Invoice::ISSUED => 'info',
        Invoice::PARTIALLY_PAID => 'warning',
        Invoice::PAID => 'success',
        Invoice::OVERDUE => 'danger',
        Invoice::VOID => 'gray',
    ];

    public static function canViewAny(): bool
    {
        return auth()->user()->can('invoices.view');
    }

    public static function canCreate(): bool
    {
        return false; // Invoices are raised from a client record, against a published price.
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->visibleTo(auth()->user())->with('client:id,full_name,client_code');
    }

    public static function infolist(Schema $schema): Schema
    {
        $tz = config('platform.timezone_display');

        return $schema->columns(3)->components([
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 2])->schema([
                Section::make('Invoice')
                    ->icon(Heroicon::OutlinedDocumentText)
                    ->columns(['default' => 2, 'md' => 4])
                    ->schema([
                        TextEntry::make('invoice_number')->label('Number')->copyable(),
                        TextEntry::make('status')->badge()
                            ->formatStateUsing(fn (string $state) => str($state)->replace('_', ' ')->ucfirst())
                            ->color(fn (string $state) => self::STATUS_COLORS[$state] ?? 'gray'),
                        TextEntry::make('invoice_date')->label('Raised')->date('d M Y', $tz),
                        TextEntry::make('due_date')->label('Due')->date('d M Y', $tz)
                            ->color(fn (Invoice $record) => $record->isOpen() && $record->due_date->isPast() ? 'danger' : null),
                        TextEntry::make('client.full_name')->label('Client')
                            ->url(fn (Invoice $record) => auth()->user()->can('view', $record->client) ? ClientResource::getUrl('view', ['record' => $record->client_id]) : null),
                        TextEntry::make('total')->label('Total')->state(fn (Invoice $record) => $record->grandTotal()->format())->weight('bold'),
                        TextEntry::make('paid')->label('Received')->state(fn (Invoice $record) => $record->amountPaid()->format()),
                        TextEntry::make('balance')->label('Balance')->state(fn (Invoice $record) => $record->balance()->format())
                            ->color(fn (Invoice $record) => $record->balance()->isZero() ? 'success' : 'warning'),
                        TextEntry::make('void_reason')->label('Voided because')->columnSpanFull()
                            ->visible(fn (Invoice $record) => $record->status === Invoice::VOID),
                    ]),
                Section::make('Lines')->icon(Heroicon::OutlinedListBullet)->schema([View::make('filament.billing.invoice-lines')]),
                Section::make('Payments')->icon(Heroicon::OutlinedBanknotes)->schema([View::make('filament.billing.invoice-payments')]),
            ]),
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 1])->schema([
                Section::make('Billed to')->icon(Heroicon::OutlinedIdentification)->schema([View::make('filament.billing.invoice-party')]),
                Section::make('Subscriptions')->icon(Heroicon::OutlinedArrowPath)->schema([View::make('filament.billing.invoice-subscriptions')]),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('invoice_number')->label('Number')->searchable()->weight('medium'),
                TextColumn::make('client.full_name')->label('Client')->searchable()
                    ->description(fn (Invoice $record) => $record->client?->client_code),
                TextColumn::make('status')->badge()
                    ->formatStateUsing(fn (string $state) => str($state)->replace('_', ' ')->ucfirst())
                    ->color(fn (string $state) => self::STATUS_COLORS[$state] ?? 'gray'),
                TextColumn::make('grand_total_paise')->label('Total')->alignEnd()
                    ->formatStateUsing(fn (Invoice $record) => $record->grandTotal()->format())->sortable(),
                TextColumn::make('balance_paise')->label('Balance')->alignEnd()
                    ->formatStateUsing(fn (Invoice $record) => $record->balance()->format())
                    ->color(fn (Invoice $record) => $record->balance()->isZero() ? 'success' : 'warning'),
                TextColumn::make('invoice_date')->label('Raised')->date('d M Y', $tz)->sortable(),
                TextColumn::make('due_date')->label('Due')->date('d M Y', $tz)->sortable()->toggleable(),
            ])
            ->filters([
                SelectFilter::make('status')->options(collect(self::STATUS_COLORS)->keys()
                    ->mapWithKeys(fn (string $status) => [$status => str($status)->replace('_', ' ')->ucfirst()->toString()])->all()),
            ])
            ->recordActions([
                ViewAction::make(),
                ActionGroup::make([
                    self::issue(),
                    self::download(),
                    self::void(),
                ]),
            ]);
    }

    public static function issue(): Action
    {
        return Action::make('issue')
            ->label('Issue')
            ->icon(Heroicon::OutlinedPaperAirplane)
            ->color('success')
            ->requiresConfirmation()
            ->modalDescription('Issuing assigns the invoice number and freezes the document. It cannot be edited afterwards.')
            ->visible(fn (Invoice $record) => $record->status === Invoice::DRAFT && auth()->user()->can('invoices.create'))
            ->action(fn (Invoice $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(InvoiceService::class)->issue(auth()->user(), $record),
                'Invoice issued',
            ));
    }

    public static function download(): Action
    {
        return Action::make('downloadInvoice')
            ->label('Download PDF')
            ->icon(Heroicon::OutlinedArrowDownTray)
            ->color('gray')
            ->visible(fn (Invoice $record) => $record->status !== Invoice::DRAFT && auth()->user()->can('documents.download'))
            ->url(function (Invoice $record) {
                $document = $record->document ?? app(BillingDocumentService::class)->invoicePdf($record, auth()->user());

                return app(DocumentVault::class)->temporaryUrl(auth()->user(), $document);
            })
            ->openUrlInNewTab();
    }

    public static function void(): Action
    {
        return Action::make('void')
            ->label('Void')
            ->icon(Heroicon::OutlinedXCircle)
            ->color('danger')
            ->visible(fn (Invoice $record) => $record->status !== Invoice::VOID && auth()->user()->can('invoices.void'))
            ->schema([Textarea::make('reason')->label('Why is this invoice being voided?')->required()->minLength(5)->maxLength(1000)->rows(2)])
            ->action(fn (array $data, Invoice $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(InvoiceService::class)->void(auth()->user(), $record, $data['reason']),
                'Invoice voided',
            ));
    }

    public static function getPages(): array
    {
        return [
            'index' => ListInvoices::route('/'),
            'view' => ViewInvoice::route('/{record}'),
        ];
    }
}
