<?php

namespace App\Filament\Resources\Allocations\Pages;

use App\Filament\Resources\Allocations\AllocationResource;
use App\Models\PaymentAllocation;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListAllocations extends ListRecords
{
    protected static string $resource = AllocationResource::class;

    public function getTabs(): array
    {
        return [
            'pending' => Tab::make('Awaiting approval')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', PaymentAllocation::SUBMITTED))
                ->badgeColor('warning')
                ->badge(fn () => AllocationResource::getEloquentQuery()->where('status', PaymentAllocation::SUBMITTED)->count() ?: null),
            'approved' => Tab::make('Approved')->modifyQueryUsing(fn (Builder $query) => $query->where('status', PaymentAllocation::APPROVED)),
            'rejected' => Tab::make('Rejected')->modifyQueryUsing(fn (Builder $query) => $query->where('status', PaymentAllocation::REJECTED)),
            'all' => Tab::make('All'),
        ];
    }
}
