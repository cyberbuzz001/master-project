<?php

namespace App\Filament\Resources\Payments;

use App\Filament\Resources\Clients\ClientResource;
use App\Filament\Resources\Invoices\InvoiceResource;
use App\Filament\Resources\Payments\Actions\PaymentActions;
use App\Filament\Resources\Payments\Pages\ListPayments;
use App\Models\Payment;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBanknotes;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?int $navigationSort = 3;

    public const STATUS_COLORS = [
        Payment::INITIATED => 'gray',
        Payment::PENDING_VERIFICATION => 'warning',
        Payment::SUCCEEDED => 'success',
        Payment::FAILED => 'danger',
        Payment::REFUNDED => 'gray',
    ];

    public static function canViewAny(): bool
    {
        return auth()->user()->can('payments.view');
    }

    public static function canCreate(): bool
    {
        return false; // Payments are recorded against an invoice or a client.
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
        return parent::getEloquentQuery()->visibleTo(auth()->user())->with(['client:id,full_name,client_code', 'invoice:id,invoice_number']);
    }

    public static function getNavigationBadge(): ?string
    {
        if (! auth()->user()->can('payments.verify_manual')) {
            return null;
        }

        $pending = static::getEloquentQuery()->where('status', Payment::PENDING_VERIFICATION)->count();

        return $pending > 0 ? (string) $pending : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->description('A payment counts only once a second person has verified it.')
            ->columns([
                TextColumn::make('client.full_name')->label('Client')->searchable()
                    ->description(fn (Payment $record) => $record->client?->client_code)
                    ->url(fn (Payment $record) => auth()->user()->can('view', $record->client) ? ClientResource::getUrl('view', ['record' => $record->client_id]) : null),
                TextColumn::make('amount_paise')->label('Amount')->alignEnd()
                    ->formatStateUsing(fn (Payment $record) => $record->amount()->format())->sortable(),
                TextColumn::make('method')->label('Method')->formatStateUsing(fn (Payment $record) => $record->methodLabel())
                    ->description(fn (Payment $record) => $record->reference),
                TextColumn::make('status')->badge()
                    ->formatStateUsing(fn (string $state) => str($state)->replace('_', ' ')->ucfirst())
                    ->color(fn (string $state) => self::STATUS_COLORS[$state] ?? 'gray'),
                TextColumn::make('invoice.invoice_number')->label('Invoice')->placeholder('On account')
                    ->url(fn (Payment $record) => $record->invoice_id && auth()->user()->can('invoices.view') ? InvoiceResource::getUrl('view', ['record' => $record->invoice_id]) : null),
                TextColumn::make('received_at')->label('Received')->dateTime('d M Y, h:i A', $tz)->sortable(),
                TextColumn::make('verifiedBy.name')->label('Verified by')->placeholder('—')->toggleable(),
            ])
            ->filters([
                SelectFilter::make('status')->options(collect(self::STATUS_COLORS)->keys()
                    ->mapWithKeys(fn (string $status) => [$status => str($status)->replace('_', ' ')->ucfirst()->toString()])->all()),
                SelectFilter::make('method')->options(config('billing.payments.labels')),
            ])
            ->recordActions([
                PaymentActions::verify(),
                ActionGroup::make([
                    PaymentActions::reject(),
                    PaymentActions::receipt(),
                    PaymentActions::allocate(),
                    PaymentActions::refund(),
                    Action::make('history')
                        ->label('History')
                        ->icon(Heroicon::OutlinedClock)
                        ->color('gray')
                        ->modalSubmitAction(false)
                        ->modalContent(fn (Payment $record) => view('filament.billing.payment-history', ['payment' => $record])),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ListPayments::route('/')];
    }
}
