<?php

namespace App\Filament\Resources\Payments\Pages;

use App\Filament\Resources\Payments\PaymentResource;
use App\Models\Payment;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListPayments extends ListRecords
{
    protected static string $resource = PaymentResource::class;

    public function getTabs(): array
    {
        return [
            'to_verify' => Tab::make('To verify')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', [Payment::PENDING_VERIFICATION, Payment::INITIATED]))
                ->badgeColor('warning')
                ->badge(fn () => PaymentResource::getEloquentQuery()->whereIn('status', [Payment::PENDING_VERIFICATION, Payment::INITIATED])->count() ?: null),
            'verified' => Tab::make('Verified')->modifyQueryUsing(fn (Builder $query) => $query->where('status', Payment::SUCCEEDED)),
            'problems' => Tab::make('Not confirmed')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', [Payment::FAILED, Payment::REFUNDED])),
            'all' => Tab::make('All'),
        ];
    }
}
