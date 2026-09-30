<?php

namespace App\Filament\Resources\Subscriptions\Pages;

use App\Filament\Resources\Subscriptions\SubscriptionResource;
use App\Models\Subscription;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListSubscriptions extends ListRecords
{
    protected static string $resource = SubscriptionResource::class;

    public function getTabs(): array
    {
        return [
            'active' => Tab::make('Active')->modifyQueryUsing(fn (Builder $query) => $query->where('status', Subscription::ACTIVE)),
            'awaiting_payment' => Tab::make('Awaiting payment')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', Subscription::PENDING_ACTIVATION))
                ->badgeColor('warning')
                ->badge(fn () => SubscriptionResource::getEloquentQuery()->where('status', Subscription::PENDING_ACTIVATION)->count() ?: null),
            'ending_soon' => Tab::make('Ending soon')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', Subscription::ACTIVE)
                    ->whereNotNull('ends_on')
                    ->whereDate('ends_on', '<=', now()->addDays(30))),
            'stopped' => Tab::make('Stopped')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', [Subscription::PAUSED, Subscription::EXPIRED, Subscription::CANCELLED])),
            'all' => Tab::make('All'),
        ];
    }
}
