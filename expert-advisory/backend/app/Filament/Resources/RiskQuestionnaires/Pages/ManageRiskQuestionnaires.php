<?php

namespace App\Filament\Resources\RiskQuestionnaires\Pages;

use App\Filament\Resources\RiskQuestionnaires\RiskQuestionnaireResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageRiskQuestionnaires extends ManageRecords
{
    protected static string $resource = RiskQuestionnaireResource::class;

    public function getSubheading(): ?string
    {
        return 'Published questionnaires are frozen so every assessment can be reproduced exactly as it was taken.';
    }

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn () => RiskQuestionnaireResource::canCreate()),
        ];
    }
}
