<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FreeTrial extends Model
{
    use HasDemoFlag, HasFactory;

    protected $fillable = [
        'trial_code', 'lead_id', 'client_id', 'employee_id', 'trial_type',
        'scope_description', 'start_date', 'end_date', 'interim_checkin_date',
        'review_meeting_date', 'status', 'client_feedback', 'drop_off_reason',
        'approved_by', 'approved_at', 'is_demo',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'interim_checkin_date' => 'date',
            'review_meeting_date' => 'date',
            'approved_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('trials.view_all')) {
            return $query;
        }

        $employee = $user->employee;
        if ($employee === null) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->can('trials.view_team') && $employee->team_id !== null) {
            return $query->whereIn('employee_id', Employee::query()->select('id')->where('team_id', $employee->team_id));
        }

        return $query->where('employee_id', $employee->id);
    }
}
