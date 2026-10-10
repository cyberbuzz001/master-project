<?php

namespace App\Filament\Resources\PaymentInstallments;

use App\Domain\Billing\Money;
use App\Filament\Resources\Clients\ClientResource;
use App\Filament\Resources\PaymentInstallments\Pages\ManagePaymentInstallments;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\PaymentInstallment;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class PaymentInstallmentResource extends Resource
{
    protected static ?string $model = PaymentInstallment::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCalendarDays;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?string $navigationLabel = 'Installments & recovery';

    protected static ?int $navigationSort = 4;

    public static function canViewAny(): bool
    {
        return auth()->user()->can('payments.view');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('client_id')
                ->label('Client')
                ->options(fn () => Client::query()->pluck('full_name', 'id'))
                ->searchable()
                ->required(),
            Select::make('invoice_id')
                ->label('Invoice')
                ->options(fn () => Invoice::query()->pluck('invoice_number', 'id'))
                ->searchable(),
            TextInput::make('installment_number')->numeric()->default(1)->required(),
            TextInput::make('amount_rupees')->label('Installment amount (₹)')->numeric()->minValue(1)->required(),
            DatePicker::make('due_date')->label('Due date')->default(today()->addDays(15))->required(),
            DatePicker::make('promised_date')->label('Client promised date'),
            Select::make('status')
                ->options([
                    'promised' => 'Promised by Client',
                    'due' => 'Payment Due',
                    'recorded' => 'Recorded / Pending Verification',
                    'confirmed' => 'Confirmed & Settled',
                    'partially_settled' => 'Partially Settled',
                    'overdue' => 'Overdue',
                    'failed' => 'Failed / Dishonoured',
                ])
                ->default('due')
                ->required(),
            Textarea::make('notes')->label('Follow-up notes / commitment details')->rows(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('due_date')
            ->columns([
                TextColumn::make('client.full_name')->label('Client')->searchable()
                    ->description(fn (PaymentInstallment $r) => $r->client?->client_code)
                    ->url(fn (PaymentInstallment $r) => ClientResource::getUrl('view', ['record' => $r->client_id])),
                TextColumn::make('installment_number')->label('Inst #')->alignCenter(),
                TextColumn::make('amount_paise')->label('Agreed amount')
                    ->formatStateUsing(fn (PaymentInstallment $r) => $r->amount()->format())->sortable(),
                TextColumn::make('amount_verified_paise')->label('Verified paid')
                    ->formatStateUsing(fn (PaymentInstallment $r) => $r->amountVerified()->format()),
                TextColumn::make('outstanding')->label('Balance due')
                    ->formatStateUsing(fn (PaymentInstallment $r) => $r->outstandingAmount()->format())
                    ->color(fn (PaymentInstallment $r) => $r->outstandingAmount()->paise > 0 ? 'danger' : 'success')
                    ->weight('bold'),
                TextColumn::make('due_date')->date('d M Y')->label('Due date')->sortable(),
                TextColumn::make('promised_date')->date('d M Y')->label('Promised')->placeholder('—'),
                TextColumn::make('status')->badge()
                    ->color(fn (string $s) => match ($s) {
                        'confirmed', 'settled' => 'success',
                        'recorded' => 'warning',
                        'promised' => 'info',
                        'overdue', 'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('reminder_attempts')->label('Nudges')->alignCenter(),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'due' => 'Due',
                    'promised' => 'Promised',
                    'recorded' => 'Pending Verification',
                    'overdue' => 'Overdue',
                    'confirmed' => 'Confirmed / Settled',
                ]),
                Filter::make('overdue')
                    ->label('Overdue installments')
                    ->query(fn (Builder $q) => $q->where('due_date', '<', today())->whereNotIn('status', ['confirmed', 'settled'])),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('send_reminder')
                    ->label('Nudge')
                    ->icon(Heroicon::OutlinedBell)
                    ->color('warning')
                    ->action(function (PaymentInstallment $r) {
                        $r->increment('reminder_attempts');
                        $r->update(['last_reminded_at' => now()]);
                        Notification::make()->success()->title('Installment reminder recorded & nudge queued.')->send();
                    }),
            ])
            ->headerActions([
                CreateAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        $data['amount_paise'] = Money::rupees($data['amount_rupees'])->paise;
                        unset($data['amount_rupees']);
                        return $data;
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManagePaymentInstallments::route('/')];
    }
}
