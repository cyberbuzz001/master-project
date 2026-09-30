<?php

namespace App\Policies;

use App\Models\Lead;
use App\Models\User;

/**
 * Leads are never hard-deleted from the UI; lifecycle changes go through LeadWorkflowService.
 */
class LeadPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public function view(User $user, Lead $lead): bool
    {
        return $this->viewAny($user) && Lead::query()->visibleTo($user)->whereKey($lead->getKey())->exists();
    }

    public function create(User $user): bool
    {
        return $user->can('leads.create');
    }

    public function update(User $user, Lead $lead): bool
    {
        return $user->can('leads.update') && $this->view($user, $lead);
    }

    public function assign(User $user, Lead $lead): bool
    {
        return $user->can('leads.assign') && $this->view($user, $lead);
    }

    public function import(User $user): bool
    {
        return $user->can('leads.import');
    }

    public function export(User $user): bool
    {
        return $user->can('leads.export');
    }

    public function delete(User $user, Lead $lead): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }

    public function forceDelete(User $user, Lead $lead): bool
    {
        return false;
    }

    public function restore(User $user, Lead $lead): bool
    {
        return false;
    }
}
