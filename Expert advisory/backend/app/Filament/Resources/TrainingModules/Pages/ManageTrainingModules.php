<?php

namespace App\Filament\Resources\TrainingModules\Pages;

use App\Domain\Audit\AuditLogger;
use App\Domain\Workforce\TrainingService;
use App\Filament\Resources\TrainingModules\TrainingModuleResource;
use App\Models\TrainingModule;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageTrainingModules extends ManageRecords
{
    protected static string $resource = TrainingModuleResource::class;

    public function getSubheading(): ?string
    {
        $pending = app(TrainingService::class)->pendingMandatoryFor(auth()->user())->count();

        return $pending > 0
            ? "You have {$pending} mandatory training module(s) to complete before using the rest of the back-office."
            : null;
    }

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn () => TrainingModuleResource::canCreate())->using(function (array $data): TrainingModule {
                $module = new TrainingModule($data);
                $module->forceFill(['status' => TrainingModule::DRAFT, 'version' => 1, 'created_by' => auth()->id()])->save();
                app(AuditLogger::class)->record('training.created', $module);

                return $module;
            }),
        ];
    }
}
