<?php

namespace App\Policies;

use App\Models\Followup;
use App\Models\Lead;
use App\Models\User;

class FollowupPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public function view(User $user, Followup $followup): bool
    {
        return Lead::query()->visibleTo($user)->whereKey($followup->lead_id)->exists();
    }

    /** Follow-ups are created from a lead via the workflow service. */
    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, Followup $followup): bool
    {
        return $user->can('followups.manage') && $this->view($user, $followup);
    }

    public function delete(User $user, Followup $followup): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }
}
