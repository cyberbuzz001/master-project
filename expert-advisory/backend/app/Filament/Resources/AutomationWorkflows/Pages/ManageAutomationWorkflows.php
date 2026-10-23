<?php

namespace App\Filament\Resources\AutomationWorkflows\Pages;

use App\Filament\Resources\AutomationWorkflows\AutomationWorkflowResource;
use Filament\Resources\Pages\ManageRecords;

class ManageAutomationWorkflows extends ManageRecords
{
    protected static string $resource = AutomationWorkflowResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}
