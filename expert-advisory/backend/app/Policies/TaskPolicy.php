<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('tasks.manage');
    }

    public function view(User $user, Task $task): bool
    {
        return $user->can('tasks.manage') && Task::query()->visibleTo($user)->whereKey($task->getKey())->exists();
    }

    public function create(User $user): bool
    {
        return $user->can('tasks.manage');
    }

    public function update(User $user, Task $task): bool
    {
        return $this->view($user, $task);
    }

    public function delete(User $user, Task $task): bool
    {
        return $task->created_by === $user->id && $task->status === 'open';
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }
}
