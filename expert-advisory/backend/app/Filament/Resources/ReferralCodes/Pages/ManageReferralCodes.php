<?php

namespace App\Filament\Resources\ReferralCodes\Pages;

use App\Filament\Resources\ReferralCodes\ReferralCodeResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageReferralCodes extends ManageRecords
{
    protected static string $resource = ReferralCodeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
