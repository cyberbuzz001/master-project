<?php

namespace App\Filament\Support;

use App\Domain\Shared\ApiException;
use Filament\Actions\Action;
use Filament\Notifications\Notification;

/**
 * Runs a domain operation from a Filament action and turns domain errors into notifications
 * (keeping the modal open) instead of error pages.
 */
final class DomainAction
{
    public static function run(Action $action, callable $operation, ?string $successTitle = null): mixed
    {
        try {
            $result = $operation();
        } catch (ApiException $e) {
            $messages = array_merge(...array_values($e->errors ?: [[]]));

            Notification::make()
                ->danger()
                ->title($e->getMessage())
                ->body($messages === [] ? null : implode(' ', array_unique($messages)))
                ->send();

            $action->halt();

            return null;
        }

        if ($successTitle !== null) {
            Notification::make()->success()->title($successTitle)->send();
        }

        return $result;
    }
}
