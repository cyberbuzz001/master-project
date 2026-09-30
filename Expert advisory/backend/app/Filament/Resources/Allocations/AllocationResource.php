<?php

namespace App\Filament\Resources\Allocations;

use App\Domain\Billing\AllocationService;
use App\Filament\Resources\Allocations\Pages\ListAllocations;
use App\Filament\Support\DomainAction;
use App\Models\PaymentAllocation;
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

/**
 * Payment credit awaiting a decision. Credit only counts once someone other than the submitter has
 * approved it, and only while the underlying payment is still verified.
 */
class AllocationResource extends Resource
{
    protected static ?string $model = PaymentAllocation::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUserPlus;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Payment credit';

    protected static ?string $slug = 'payment-credit';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['allocations.submit', 'allocations.approve']);
    }

    public static function canCreate(): bool
    {
        return false; // Credit is submitted from the payment it belongs to.
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
        $query = parent::getEloquentQuery()->with(['employee.user:id,name', 'payment.client:id,full_name,client_code']);

        if (auth()->user()->can('allocations.approve')) {
            return $query;
        }

        // Someone who can only submit sees their own submissions and their own credit.
        $employeeId = auth()->user()->employee?->id;

        return $query->where(fn (Builder $inner) => $inner
            ->where('submitted_by', auth()->id())
            ->orWhere('employee_id', $employeeId));
    }

    public static function getNavigationBadge(): ?string
    {
        if (! auth()->user()->can('allocations.approve')) {
            return null;
        }

        $pending = static::getEloquentQuery()->where('status', PaymentAllocation::SUBMITTED)->count();

        return $pending > 0 ? (string) $pending : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $allocations = app(AllocationService::class);

        return $table
            ->defaultSort('id', 'desc')
            ->description('Credit counts only after approval by a second person, and only while the payment behind it stays verified.')
            ->columns([
                TextColumn::make('employee.user.name')->label('Credited to')->searchable(),
                TextColumn::make('amount_paise')->label('Amount')->alignEnd()
                    ->formatStateUsing(fn (PaymentAllocation $record) => $record->amount()->format())->sortable(),
                TextColumn::make('payment.client.full_name')->label('Client')
                    ->description(fn (PaymentAllocation $record) => $record->payment?->client?->client_code),
                TextColumn::make('payment_status')->label('Payment')->badge()
                    ->state(fn (PaymentAllocation $record) => str($record->payment?->status ?? '')->replace('_', ' ')->ucfirst())
                    ->color(fn (PaymentAllocation $record) => $record->payment?->isVerified() ? 'success' : 'warning'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    PaymentAllocation::APPROVED => 'success',
                    PaymentAllocation::REJECTED => 'danger',
                    default => 'warning',
                }),
                TextColumn::make('created_at')->label('Submitted')->dateTime('d M Y, h:i A', $tz)->sortable()->toggleable(),
                TextColumn::make('decision_reason')->label('Note')->wrap()->placeholder('—')->toggleable(),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    PaymentAllocation::SUBMITTED => 'Awaiting approval',
                    PaymentAllocation::APPROVED => 'Approved',
                    PaymentAllocation::REJECTED => 'Rejected',
                ]),
            ])
            ->recordActions([
                Action::make('approve')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Approving records that this employee earned credit for the payment.')
                    ->visible(fn (PaymentAllocation $record) => auth()->user()->can('allocations.approve') && $record->status !== PaymentAllocation::APPROVED)
                    ->action(fn (PaymentAllocation $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $allocations->approve(auth()->user(), $record),
                        'Credit approved',
                    )),
                Action::make('reject')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('danger')
                    ->visible(fn (PaymentAllocation $record) => auth()->user()->can('allocations.approve') && $record->status !== PaymentAllocation::REJECTED)
                    ->schema([Textarea::make('reason')->label('Why is this being rejected?')->required()->minLength(5)->maxLength(1000)->rows(2)])
                    ->action(fn (array $data, PaymentAllocation $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $allocations->reject(auth()->user(), $record, $data['reason']),
                        'Credit rejected',
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ListAllocations::route('/')];
    }
}
