<?php

namespace App\Filament\Resources\SystemSettings\Pages;

use App\Filament\Resources\SystemSettings\SystemSettingResource;
use Filament\Resources\Pages\ManageRecords;

class ManageSystemSettings extends ManageRecords
{
    protected static string $resource = SystemSettingResource::class;
}
