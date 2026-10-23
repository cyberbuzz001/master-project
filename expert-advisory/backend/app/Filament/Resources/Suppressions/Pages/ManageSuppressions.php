<?php

namespace App\Filament\Resources\Suppressions\Pages;

use App\Filament\Resources\Suppressions\SuppressionResource;
use Filament\Resources\Pages\ManageRecords;

class ManageSuppressions extends ManageRecords
{
    protected static string $resource = SuppressionResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}
