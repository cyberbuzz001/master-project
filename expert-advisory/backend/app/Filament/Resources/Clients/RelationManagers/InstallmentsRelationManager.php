<?php

namespace App\Filament\Resources\Clients\RelationManagers;

use App\Domain\Billing\Money;
use App\Models\PaymentInstallment;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class InstallmentsRelationManager extends RelationManager
{
    protected static string $relationship = 'installments';

    protected static ?string $title = 'Installments & Balance Recovery';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedCalendarDays;

    public function table(Table $table): Table
    {
        return $table
            ->description('Schedule of payment installments, committed dates, and balance recovery tracking.')
            ->defaultSort('installment_number')
            ->columns([
                TextColumn::make('installment_number')->label('Inst #')->alignCenter(),
                TextColumn::make('amount_paise')->label('Agreed amount')
                    ->formatStateUsing(fn (PaymentInstallment $r) => $r->amount()->format()),
                TextColumn::make('amount_verified_paise')->label('Verified paid')
                    ->formatStateUsing(fn (PaymentInstallment $r) => $r->amountVerified()->format()),
                TextColumn::make('outstanding')->label('Balance due')
                    ->state(fn (PaymentInstallment $r) => $r->outstandingAmount()->format())
                    ->color(fn (PaymentInstallment $r) => $r->outstandingAmount()->paise > 0 ? 'danger' : 'success')
                    ->weight('bold'),
                TextColumn::make('due_date')->date('d M Y')->label('Due date'),
                TextColumn::make('promised_date')->date('d M Y')->label('Promised date')->placeholder('—'),
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
            ->recordActions([
                EditAction::make(),
                Action::make('nudge')
                    ->label('Nudge')
                    ->icon(Heroicon::OutlinedBell)
                    ->color('warning')
                    ->action(function (PaymentInstallment $r) {
                        $r->increment('reminder_attempts');
                        $r->update(['last_reminded_at' => now()]);
                        Notification::make()->success()->title('Client payment reminder nudge recorded.')->send();
                    }),
            ])
            ->headerActions([
                CreateAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        $data['amount_paise'] = Money::rupees((float) $data['amount_rupees'])->paise;
                        unset($data['amount_rupees']);
                        return $data;
                    })
                    ->form([
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
                                'overdue' => 'Overdue',
                            ])
                            ->default('due')
                            ->required(),
                        Textarea::make('notes')->label('Notes / recovery commitment')->rows(2),
                    ]),
            ]);
    }
}
