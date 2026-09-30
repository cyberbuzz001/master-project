<?php

namespace App\Filament\Resources\LeadImports\Pages;

use App\Filament\Resources\LeadImports\LeadImportResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageLeadImports extends ManageRecords
{
    protected static string $resource = LeadImportResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}
