<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * `is_authorized_research_person` is deliberately not fillable: it changes only through
 * the compliance authorization action, which records who authorized and when.
 */
#[Fillable(['user_id', 'employee_code', 'designation', 'team_id', 'reports_to_employee_id', 'joined_on', 'status', 'is_demo'])]
class Employee extends Model
{
    use HasDemoFlag, HasFactory;

    protected function casts(): array
    {
        return [
            'joined_on' => 'date',
            'is_authorized_research_person' => 'boolean',
            'research_authorized_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reports_to_employee_id');
    }

    public function assignedLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'assigned_employee_id');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(Followup::class);
    }

    /**
     * Label used in selects and tables.
     */
    public function displayName(): string
    {
        return trim(($this->user?->name ?? 'Employee').' ('.$this->employee_code.')');
    }
}
