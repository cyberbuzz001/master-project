<?php

namespace App\Filament\Resources\ResearchReports\Pages;

use App\Filament\Resources\ResearchReports\ResearchReportResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListResearchReports extends ListRecords
{
    protected static string $resource = ResearchReportResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
