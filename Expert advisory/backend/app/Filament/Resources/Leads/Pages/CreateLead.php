<?php

namespace App\Filament\Resources\Leads\Pages;

use App\Domain\Crm\LeadIntakeService;
use App\Domain\Shared\ApiException;
use App\Filament\Resources\Leads\LeadResource;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateLead extends CreateRecord
{
    protected static string $resource = LeadResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        try {
            return app(LeadIntakeService::class)->createByStaff(auth()->user(), $data);
        } catch (ApiException $e) {
            Notification::make()->danger()->title($e->getMessage())->send();
            $this->halt();
        }
    }

    protected function getRedirectUrl(): string
    {
        return LeadResource::getUrl('view', ['record' => $this->record]);
    }
}
