<?php

namespace App\Filament\Resources\Subscriptions;

use App\Domain\Billing\SubscriptionService;
use App\Filament\Resources\Clients\ClientResource;
use App\Filament\Resources\Invoices\InvoiceResource;
use App\Filament\Resources\Subscriptions\Pages\ListSubscriptions;
use App\Filament\Support\DomainAction;
use App\Models\Subscription;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class SubscriptionResource extends Resource
{
    protected static ?string $model = Subscription::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedArrowPath;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?int $navigationSort = 4;

    public const STATUS_COLORS = [
        Subscription::PENDING_ACTIVATION => 'warning',
        Subscription::ACTIVE => 'success',
        Subscription::PAUSED => 'danger',
        Subscription::EXPIRED => 'gray',
        Subscription::CANCELLED => 'gray',
    ];

    public static function canViewAny(): bool
    {
        return auth()->user()->can('subscriptions.view');
    }

    public static function canCreate(): bool
    {
        return false; // Sold from the client record, against a published price.
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
        return parent::getEloquentQuery()
            ->visibleTo(auth()->user())
            ->with(['client:id,full_name,client_code', 'planVersion.plan.service', 'invoice:id,invoice_number,status']);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->description('A service starts only when a verified payment settles its invoice, and is paused again if that payment is refunded.')
            ->columns([
                TextColumn::make('client.full_name')->label('Client')->searchable()
                    ->description(fn (Subscription $record) => $record->client?->client_code)
                    ->url(fn (Subscription $record) => auth()->user()->can('view', $record->client) ? ClientResource::getUrl('view', ['record' => $record->client_id]) : null),
                TextColumn::make('planVersion.plan.name')->label('Plan')
                    ->description(fn (Subscription $record) => $record->planVersion?->plan?->service?->name),
                TextColumn::make('status')->badge()
                    ->formatStateUsing(fn (string $state) => str($state)->replace('_', ' ')->ucfirst())
                    ->color(fn (string $state) => self::STATUS_COLORS[$state] ?? 'gray'),
                TextColumn::make('starts_on')->label('From')->date('d M Y', $tz)->placeholder('—'),
                TextColumn::make('ends_on')->label('Until')->date('d M Y', $tz)->placeholder('—')
                    ->description(fn (Subscription $record) => $record->isRunning() && $record->daysRemaining() !== null
                        ? $record->daysRemaining().' days left'
                        : null)
                    ->color(fn (Subscription $record) => $record->isRunning() && ($record->daysRemaining() ?? 99) <= 7 ? 'warning' : null),
                TextColumn::make('invoice.invoice_number')->label('Invoice')->placeholder('—')
                    ->url(fn (Subscription $record) => $record->invoice_id && auth()->user()->can('invoices.view') ? InvoiceResource::getUrl('view', ['record' => $record->invoice_id]) : null),
            ])
            ->filters([
                SelectFilter::make('status')->options(collect(self::STATUS_COLORS)->keys()
                    ->mapWithKeys(fn (string $status) => [$status => str($status)->replace('_', ' ')->ucfirst()->toString()])->all()),
            ])
            ->recordActions([
                Action::make('activate')
                    ->label('Activate')
                    ->icon(Heroicon::OutlinedPlayCircle)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Only possible once the invoice is settled by a verified payment.')
                    ->visible(fn (Subscription $record) => auth()->user()->can('subscriptions.activate')
                        && in_array($record->status, [Subscription::PENDING_ACTIVATION, Subscription::PAUSED], true))
                    ->action(fn (Subscription $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => app(SubscriptionService::class)->activate($record, auth()->user(), 'Activated from the back-office'),
                        'Service activated',
                    )),
                Action::make('cancel')
                    ->label('Cancel')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('danger')
                    ->visible(fn (Subscription $record) => auth()->user()->can('subscriptions.activate')
                        && ! in_array($record->status, [Subscription::CANCELLED, Subscription::EXPIRED], true))
                    ->schema([Textarea::make('reason')->label('Why is this being cancelled?')->required()->minLength(5)->maxLength(1000)->rows(2)])
                    ->action(fn (array $data, Subscription $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => app(SubscriptionService::class)->cancel(auth()->user(), $record, $data['reason']),
                        'Subscription cancelled',
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ListSubscriptions::route('/')];
    }
}
