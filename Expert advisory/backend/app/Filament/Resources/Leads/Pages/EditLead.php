<?php

namespace App\Filament\Resources\Leads\Pages;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\Leads\LeadResource;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

/**
 * Profile fields only. Status, ownership and follow-ups change through workflow actions.
 */
class EditLead extends EditRecord
{
    protected static string $resource = LeadResource::class;

    private const EDITABLE = ['full_name', 'mobile', 'email', 'city', 'state', 'broker', 'preferred_segments', 'capital_range', 'trading_experience', 'message'];

    protected function getHeaderActions(): array
    {
        return [ViewAction::make()];
    }

    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        $original = $record->getOriginal();
        $record->fill(array_intersect_key($data, array_flip(self::EDITABLE)))->save();

        if ($record->wasChanged()) {
            app(AuditLogger::class)->recordChanges('lead.profile_updated', $record, $original);
        }

        return $record;
    }

    protected function getRedirectUrl(): string
    {
        return LeadResource::getUrl('view', ['record' => $this->record]);
    }
}
