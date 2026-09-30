<?php

namespace App\Filament\Resources\RegulatoryProfiles\Pages;

use App\Domain\Compliance\RegulatoryProfileService;
use App\Filament\Resources\RegulatoryProfiles\RegulatoryProfileResource;
use App\Filament\Support\DomainAction;
use App\Filament\Widgets\ComplianceReadinessWidget;
use Filament\Actions\Action;
use Filament\Resources\Pages\ManageRecords;
use Filament\Support\Icons\Heroicon;

class ManageRegulatoryProfiles extends ManageRecords
{
    protected static string $resource = RegulatoryProfileResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('newDraft')
                ->label('New draft version')
                ->icon(Heroicon::OutlinedPlus)
                ->visible(fn () => auth()->user()->can('regulatory_profile.edit'))
                ->modalWidth('4xl')
                ->schema(RegulatoryProfileResource::profileSchema())
                ->action(fn (array $data, Action $action) => DomainAction::run(
                    $action,
                    fn () => app(RegulatoryProfileService::class)->createDraft(auth()->user(), $data),
                    'Draft created',
                )),
        ];
    }

    protected function getHeaderWidgets(): array
    {
        return [ComplianceReadinessWidget::class];
    }
}
