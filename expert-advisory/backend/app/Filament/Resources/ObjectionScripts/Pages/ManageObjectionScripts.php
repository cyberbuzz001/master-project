<?php

namespace App\Filament\Resources\ObjectionScripts\Pages;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\ObjectionScripts\ObjectionScriptResource;
use App\Models\ObjectionScript;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageObjectionScripts extends ManageRecords
{
    protected static string $resource = ObjectionScriptResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn () => ObjectionScriptResource::canCreate())->using(function (array $data): ObjectionScript {
                $script = new ObjectionScript($data);
                $script->forceFill(['status' => ObjectionScript::DRAFT, 'created_by' => auth()->id()])->save();
                app(AuditLogger::class)->record('objection_script.created', $script);

                return $script;
            }),
        ];
    }
}
