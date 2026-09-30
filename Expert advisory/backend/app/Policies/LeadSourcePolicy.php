<?php

namespace App\Policies;

use App\Policies\Concerns\PermissionPolicy;

class LeadSourcePolicy extends PermissionPolicy
{
    protected function viewPermission(): string
    {
        return 'campaigns.view';
    }

    protected function managePermission(): string
    {
        return 'campaigns.manage';
    }
}
