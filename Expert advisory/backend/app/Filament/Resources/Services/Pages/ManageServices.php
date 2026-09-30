<?php

namespace App\Filament\Resources\Services\Pages;

use App\Filament\Resources\Services\ServiceResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageServices extends ManageRecords
{
    protected static string $resource = ServiceResource::class;

    public function getSubheading(): ?string
    {
        return 'Prices are versioned: an invoice always points at the exact price that was published when it was raised.';
    }

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->visible(fn () => ServiceResource::canCreate())];
    }
}
