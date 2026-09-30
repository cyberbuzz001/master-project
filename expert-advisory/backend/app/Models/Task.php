<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['title', 'description', 'assignee_employee_id', 'created_by', 'taskable_type', 'taskable_id', 'priority', 'status', 'due_at', 'is_demo'])]
class Task extends Model
{
    use HasDemoFlag;

    protected function casts(): array
    {
        return ['due_at' => 'datetime', 'completed_at' => 'datetime', 'is_demo' => 'boolean'];
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assignee_employee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function taskable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Own tasks and tasks the user created; team leaders see their team; managers with view_all see everything.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('leads.view_all')) {
            return $query;
        }

        $employee = $user->employee;

        return $query->where(function (Builder $q) use ($user, $employee): void {
            $q->where('created_by', $user->id);

            if ($employee !== null) {
                $q->orWhere('assignee_employee_id', $employee->id);

                if ($user->can('leads.view_team') && $employee->team_id !== null) {
                    $q->orWhereIn('assignee_employee_id', Employee::query()->select('id')->where('team_id', $employee->team_id));
                }
            }
        });
    }
}
