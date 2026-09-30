<?php

namespace App\Filament\Resources\Users\Pages;

use App\Domain\Identity\StaffUserService;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Support\DomainAction;
use Filament\Actions\Action;
use Filament\Resources\Pages\ManageRecords;
use Filament\Support\Icons\Heroicon;

class ManageUsers extends ManageRecords
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('createStaff')
                ->label('Add staff user')
                ->icon(Heroicon::OutlinedUserPlus)
                ->visible(fn () => UserResource::canCreate())
                ->modalWidth('2xl')
                ->schema(UserResource::createSchema())
                ->action(fn (array $data, Action $action) => DomainAction::run(
                    $action,
                    fn () => app(StaffUserService::class)->create(auth()->user(), $data),
                    'Staff user created',
                )),
        ];
    }
}
