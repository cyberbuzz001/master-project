<?php

namespace App\Filament\Resources\Teams\Pages;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\Teams\TeamResource;
use App\Models\Team;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageTeams extends ManageRecords
{
    protected static string $resource = TeamResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->after(fn (Team $record) => app(AuditLogger::class)->record('team.created', $record, new: $record->only(['name', 'leader_employee_id']))),
        ];
    }
}
