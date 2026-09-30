<?php

namespace App\Policies\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Simple permission-mapped policy for reference data. Deletion is disabled: records are
 * deactivated instead so historical attribution stays intact.
 */
abstract class PermissionPolicy
{
    abstract protected function viewPermission(): string;

    abstract protected function managePermission(): string;

    public function viewAny(User $user): bool
    {
        return $user->canAny([$this->viewPermission(), $this->managePermission()]);
    }

    public function view(User $user, Model $model): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can($this->managePermission());
    }

    public function update(User $user, Model $model): bool
    {
        return $user->can($this->managePermission());
    }

    public function delete(User $user, Model $model): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }
}
