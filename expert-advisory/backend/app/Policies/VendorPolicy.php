<?php

namespace App\Policies;

use App\Policies\Concerns\PermissionPolicy;

class VendorPolicy extends PermissionPolicy
{
    protected function viewPermission(): string
    {
        return 'vendors.view';
    }

    protected function managePermission(): string
    {
        return 'vendors.manage';
    }
}
