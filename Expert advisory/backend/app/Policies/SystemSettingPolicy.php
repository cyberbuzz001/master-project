<?php

namespace App\Policies;

use App\Policies\Concerns\PermissionPolicy;

class SystemSettingPolicy extends PermissionPolicy
{
    protected function viewPermission(): string
    {
        return 'settings.view';
    }

    protected function managePermission(): string
    {
        return 'settings.manage';
    }
}
