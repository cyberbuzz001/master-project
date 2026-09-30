<?php

namespace App\Filament\Resources\Agreements\Pages;

use App\Filament\Resources\Agreements\AgreementResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageAgreements extends ManageRecords
{
    protected static string $resource = AgreementResource::class;

    public function getSubheading(): ?string
    {
        return 'Agreement text is drafted, approved by a second person, then published. Accepted text can never be edited.';
    }

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn () => AgreementResource::canCreate()),
        ];
    }
}
