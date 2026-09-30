<?php

namespace App\Filament\Resources\Invoices\Pages;

use App\Filament\Resources\Invoices\InvoiceResource;
use App\Models\Invoice;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListInvoices extends ListRecords
{
    protected static string $resource = InvoiceResource::class;

    public function getTabs(): array
    {
        return [
            'open' => Tab::make('Open')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', [Invoice::ISSUED, Invoice::PARTIALLY_PAID, Invoice::OVERDUE]))
                ->badge(fn () => InvoiceResource::getEloquentQuery()->whereIn('status', [Invoice::ISSUED, Invoice::PARTIALLY_PAID, Invoice::OVERDUE])->count()),
            'overdue' => Tab::make('Overdue')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', Invoice::OVERDUE))
                ->badgeColor('danger')
                ->badge(fn () => InvoiceResource::getEloquentQuery()->where('status', Invoice::OVERDUE)->count() ?: null),
            'drafts' => Tab::make('Drafts')->modifyQueryUsing(fn (Builder $query) => $query->where('status', Invoice::DRAFT)),
            'paid' => Tab::make('Paid')->modifyQueryUsing(fn (Builder $query) => $query->where('status', Invoice::PAID)),
            'all' => Tab::make('All'),
        ];
    }
}
