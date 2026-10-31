<?php

namespace App\Filament\Resources\LeadImportBatches\Pages;

use App\Filament\Resources\LeadImportBatches\LeadImportBatchResource;
use Filament\Resources\Pages\ManageRecords;

class ManageLeadImportBatches extends ManageRecords
{
    protected static string $resource = LeadImportBatchResource::class;

    protected function getHeaderActions(): array
    {
        return [
            LeadImportBatchResource::getUniversalImportAction(),
        ];
    }
}
