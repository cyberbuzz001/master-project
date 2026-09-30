<?php

namespace App\Filament\Resources\Clients\Pages;

use App\Filament\Resources\Clients\ClientResource;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListClients extends ListRecords
{
    protected static string $resource = ClientResource::class;

    public function getTabs(): array
    {
        return [
            'onboarding' => Tab::make('Onboarding')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('onboarding_status', ['LEAD', 'ONBOARDING']))
                ->badge(fn () => ClientResource::getEloquentQuery()->whereIn('onboarding_status', ['LEAD', 'ONBOARDING'])->count()),
            'active' => Tab::make('Active')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('onboarding_status', 'ACTIVE')),
            'attention' => Tab::make('Needs attention')
                ->modifyQueryUsing(fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                    ->where('kyc_status', 'rejected')
                    ->orWhere('onboarding_status', 'ON_HOLD')
                    ->orWhereHas('riskProfiles', fn (Builder $profiles) => $profiles->where('status', 'finalized')->whereNotNull('expires_at')->where('expires_at', '<', now())))),
            'all' => Tab::make('All'),
        ];
    }
}
