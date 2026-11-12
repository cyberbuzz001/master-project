<?php

namespace App\Policies;

use App\Models\FreeTrial;
use App\Models\User;

class FreeTrialPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public function view(User $user, FreeTrial $trial): bool
    {
        return $trial->lead && $user->can('view', $trial->lead);
    }

    public function create(User $user): bool
    {
        return $user->can('leads.update');
    }

    public function update(User $user, FreeTrial $trial): bool
    {
        return $trial->status === 'requested' && $trial->lead && $user->can('update', $trial->lead);
    }

    public function approve(User $user, FreeTrial $trial): bool
    {
        return $user->can('leads.assign') && $this->view($user, $trial) && $trial->status === 'requested';
    }

    public function cancel(User $user, FreeTrial $trial): bool
    {
        return $trial->lead && $user->can('update', $trial->lead) && in_array($trial->status, ['requested', 'approved', 'active'], true);
    }

    public function delete(User $user, FreeTrial $trial): bool
    {
        return false;
    }
}
