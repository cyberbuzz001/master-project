<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['employee_id', 'work_date', 'first_seen_at', 'last_seen_at', 'active_minutes', 'requests', 'first_ip', 'outside_office_hours'])]
class AttendanceDay extends Model
{
    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'outside_office_hours' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Own attendance always; team for team leaders; everyone for managers.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('attendance.view_all')) {
            return $query;
        }

        $employee = $user->employee;
        if ($employee === null) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->can('attendance.view_team') && $employee->team_id !== null) {
            return $query->whereIn('employee_id', Employee::query()->select('id')->where('team_id', $employee->team_id));
        }

        return $query->where('employee_id', $employee->id);
    }
}
