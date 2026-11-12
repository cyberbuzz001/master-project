<?php

namespace App\Policies;

use App\Models\LeadImportBatch;
use App\Models\User;

class LeadImportBatchPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('leads.import');
    }

    public function view(User $user, LeadImportBatch $batch): bool
    {
        return $this->viewAny($user) && ($user->can('leads.view_all') || $batch->uploaded_by_id === $user->id);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, LeadImportBatch $batch): bool
    {
        return false;
    }

    public function delete(User $user, LeadImportBatch $batch): bool
    {
        return false;
    }
}
