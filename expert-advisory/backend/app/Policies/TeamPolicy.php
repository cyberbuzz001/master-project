<?php

namespace App\Policies;

use App\Policies\Concerns\PermissionPolicy;

class TeamPolicy extends PermissionPolicy
{
    protected function viewPermission(): string
    {
        return 'teams.view';
    }

    protected function managePermission(): string
    {
        return 'teams.manage';
    }
}
