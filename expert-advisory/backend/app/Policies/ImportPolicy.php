<?php

namespace App\Policies;

use App\Models\User;
use Filament\Actions\Imports\Models\Import;

class ImportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('leads.import');
    }

    /** Also governs downloading the failed-rows CSV. */
    public function view(User $user, Import $import): bool
    {
        return $user->can('leads.import') && ($import->user_id === $user->id || $user->can('leads.view_all'));
    }

    public function rollback(User $user, Import $import): bool
    {
        return $this->view($user, $import) && $import->completed_at !== null && $import->rolled_back_at === null;
    }
}
