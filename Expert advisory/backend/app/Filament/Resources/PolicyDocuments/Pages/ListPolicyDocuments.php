<?php

namespace App\Filament\Resources\PolicyDocuments\Pages;

use App\Filament\Resources\PolicyDocuments\PolicyDocumentResource;
use Filament\Resources\Pages\ListRecords;

class ListPolicyDocuments extends ListRecords
{
    protected static string $resource = PolicyDocumentResource::class;
}
