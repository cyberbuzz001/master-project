<?php

namespace App\Policies;

use App\Policies\Concerns\PermissionPolicy;

class ReferralCodePolicy extends PermissionPolicy
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
