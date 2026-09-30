<?php

namespace App\Filament\Resources\Payments\Actions;

use App\Domain\Billing\BillingDocumentService;
use App\Domain\Billing\Money;
use App\Domain\Billing\PaymentService;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Shared\ApiException;
use App\Filament\Support\DomainAction;
use App\Models\Client;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use Filament\Actions\Action;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Component;
use Filament\Support\Icons\Heroicon;

/**
 * Payment actions. Recording, verifying and refunding all go through the domain service, so the
 * separation-of-duties and activation rules cannot be bypassed from the UI.
 */
final class PaymentActions
{
    /**
     * Header action on an invoice: record money received against it.
     */
    public static function recordForInvoice(): Action
    {
        return Action::make('recordPayment')
            ->label('Record payment')
            ->icon(Heroicon::OutlinedBanknotes)
            ->color('primary')
            ->visible(fn (Invoice $record) => $record->isOpen() && auth()->user()->can('payments.view'))
            ->modalDescription('Record what the client says they paid. It counts only once a second person verifies it.')
            ->schema(fn (Invoice $record) => self::fields($record->client, $record))
            ->fillForm(fn (Invoice $record) => ['amount_rupees' => $record->balance()->toDecimal(), 'received_at' => now()])
            ->action(fn (array $data, Invoice $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(PaymentService::class)->record(auth()->user(), $record->client, self::payload($data, $record->id)),
                'Payment recorded — it now needs verification',
            ));
    }

    public static function verify(): Action
    {
        return Action::make('verify')
            ->label('Verify')
            ->icon(Heroicon::OutlinedCheckBadge)
            ->color('success')
            ->requiresConfirmation()
            ->modalDescription('Confirm the money has actually reached the bank or UPI account. Verifying settles the invoice and can start a service.')
            ->schema([Textarea::make('note')->label('Note (optional)')->rows(2)->maxLength(1000)])
            ->visible(fn (Payment $record) => auth()->user()->can('payments.verify_manual')
                && in_array($record->status, [Payment::PENDING_VERIFICATION, Payment::INITIATED, Payment::FAILED], true))
            ->action(fn (array $data, Payment $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(PaymentService::class)->verify(auth()->user(), $record, $data['note'] ?? null),
                'Payment verified',
            ));
    }

    public static function reject(): Action
    {
        return Action::make('reject')
            ->label('Could not confirm')
            ->icon(Heroicon::OutlinedXCircle)
            ->color('danger')
            ->visible(fn (Payment $record) => auth()->user()->can('payments.verify_manual')
                && in_array($record->status, [Payment::PENDING_VERIFICATION, Payment::INITIATED], true))
            ->schema([Textarea::make('reason')->label('What did you find?')->required()->minLength(5)->maxLength(1000)->rows(2)])
            ->action(fn (array $data, Payment $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(PaymentService::class)->reject(auth()->user(), $record, $data['reason']),
                'Payment marked as not confirmed',
            ));
    }

    public static function refund(): Action
    {
        return Action::make('refund')
            ->label('Record refund')
            ->icon(Heroicon::OutlinedArrowUturnLeft)
            ->color('warning')
            ->visible(fn (Payment $record) => auth()->user()->can('payments.refund') && $record->status === Payment::SUCCEEDED)
            ->modalDescription('Record that the money has gone back to the client. Any service this payment started is paused.')
            ->schema([Textarea::make('reason')->label('Why is this being refunded?')->required()->minLength(5)->maxLength(1000)->rows(2)])
            ->action(fn (array $data, Payment $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(PaymentService::class)->refund(auth()->user(), $record, $data['reason']),
                'Refund recorded',
            ));
    }

    public static function receipt(): Action
    {
        return Action::make('receipt')
            ->label('Receipt')
            ->icon(Heroicon::OutlinedArrowDownTray)
            ->color('gray')
            ->visible(fn (Payment $record) => $record->isVerified() && auth()->user()->can('documents.download'))
            ->url(function (Payment $record) {
                $receipt = app(BillingDocumentService::class)->receiptFor($record, auth()->user());

                return $receipt?->document === null ? null : app(DocumentVault::class)->temporaryUrl(auth()->user(), $receipt->document);
            })
            ->openUrlInNewTab();
    }

    public static function allocate(): Action
    {
        return Action::make('allocate')
            ->label('Credit an employee')
            ->icon(Heroicon::OutlinedUserPlus)
            ->color('gray')
            ->visible(fn (Payment $record) => auth()->user()->can('allocations.submit') && $record->isVerified())
            ->modalDescription('Credit for this payment is recorded here and has to be approved by someone else before it counts.')
            ->schema(fn (Payment $record) => [
                Select::make('employee_id')
                    ->label('Employee')
                    ->options(Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                    ->searchable()
                    ->required()
                    ->native(false),
                TextInput::make('amount_rupees')
                    ->label('Amount to credit (₹)')
                    ->numeric()
                    ->minValue(1)
                    ->default($record->amount()->toDecimal())
                    ->required(),
                Textarea::make('note')->rows(2)->maxLength(1000),
            ])
            ->action(fn (array $data, Payment $record, Action $action) => DomainAction::run($action, function () use ($data, $record) {
                $amount = Money::rupees($data['amount_rupees']);

                if ($amount->greaterThan($record->amount())) {
                    throw ApiException::unprocessable('ALLOCATION_TOO_LARGE', 'Credit cannot exceed the payment.');
                }

                return PaymentAllocation::updateOrCreate(
                    ['payment_id' => $record->id, 'employee_id' => $data['employee_id']],
                    [
                        'amount_paise' => $amount->paise,
                        'note' => $data['note'] ?? null,
                        'submitted_by' => auth()->id(),
                        'status' => PaymentAllocation::SUBMITTED,
                    ],
                );
            }, 'Credit submitted for approval'));
    }

    /**
     * @return list<Component>
     */
    public static function fields(Client $client, ?Invoice $invoice = null): array
    {
        return [
            Select::make('method')
                ->options(collect(config('billing.payments.manual_methods'))
                    ->mapWithKeys(fn (string $method) => [$method => config("billing.payments.labels.{$method}", $method)])->all())
                ->default('upi')
                ->required()
                ->native(false)
                ->live(),
            TextInput::make('amount_rupees')->label('Amount received (₹)')->numeric()->minValue(1)->required(),
            TextInput::make('reference')->label('UTR / reference')->maxLength(128),
            DateTimePicker::make('received_at')->label('Received at')->seconds(false)->timezone(config('platform.timezone_display'))->required(),
            Select::make('proof_document_id')
                ->label('Proof')
                ->options(Document::query()
                    ->where(['owner_type' => 'client', 'owner_id' => $client->id])
                    ->orderByDesc('id')
                    ->pluck('title', 'id'))
                ->helperText('Upload the screenshot or bank advice under the client\'s documents first. Cash does not need proof.')
                ->native(false),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(array $data, ?int $invoiceId = null): array
    {
        return [
            'invoice_id' => $invoiceId,
            'amount_paise' => Money::rupees($data['amount_rupees'])->paise,
            'method' => $data['method'],
            'reference' => $data['reference'] ?? null,
            'received_at' => $data['received_at'] ?? now(),
            'proof_document_id' => $data['proof_document_id'] ?? null,
        ];
    }
}
