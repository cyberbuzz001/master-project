<?php

namespace App\Filament\Resources\Clients\Pages;

use App\Filament\Resources\Clients\Actions\ClientActions;
use App\Filament\Resources\Clients\ClientResource;
use Filament\Actions\ActionGroup;
use Filament\Resources\Pages\ViewRecord;

class ViewClient extends ViewRecord
{
    protected static string $resource = ClientResource::class;

    public function getHeading(): string
    {
        return $this->record->full_name;
    }

    public function getSubheading(): ?string
    {
        return $this->record->client_code;
    }

    protected function getHeaderActions(): array
    {
        return [
            ClientActions::sellService(),
            ClientActions::takeAssessment(),
            ClientActions::uploadDocument(),
            ActionGroup::make([
                ClientActions::completeStep(),
                ClientActions::recordAcceptance(),
                ClientActions::activate(),
                ClientActions::hold(),
                ClientActions::close(),
            ])->label('Onboarding')->button(),
        ];
    }
}
