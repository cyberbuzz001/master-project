<?php

namespace App\Filament\Resources\Leads\Pages;

use App\Filament\Resources\Leads\Actions\LeadActions;
use App\Filament\Resources\Leads\LeadResource;
use Filament\Actions\ActionGroup;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewLead extends ViewRecord
{
    protected static string $resource = LeadResource::class;

    protected function getHeaderActions(): array
    {
        return [
            LeadActions::dial(),
            LeadActions::whatsapp(),
            LeadActions::logCall(),
            LeadActions::scheduleFollowup(),
            LeadActions::changeStatus(),
            LeadActions::convertToClient(),
            ActionGroup::make([
                LeadActions::addNote(),
                LeadActions::assign(),
                LeadActions::clearDuplicate(),
                EditAction::make()->label('Edit details'),
            ])->label('More')->button()->color('gray'),
        ];
    }

    public function getRelationManagersContentTabLabel(): ?string
    {
        return 'Overview';
    }
}
