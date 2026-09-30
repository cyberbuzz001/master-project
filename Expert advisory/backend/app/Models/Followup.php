<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['lead_id', 'employee_id', 'channel', 'due_at', 'notes', 'created_by', 'is_demo'])]
class Followup extends Model
{
    use HasDemoFlag;

    public const PENDING = 'pending';

    public const DONE = 'done';

    public const MISSED = 'missed';

    public const CANCELLED = 'cancelled';

    public const CHANNELS = ['call' => 'Call', 'whatsapp' => 'WhatsApp', 'email' => 'Email', 'meeting' => 'Meeting'];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
            'reminded_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Follow-ups belong to leads, so they inherit the lead's visibility.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->whereHas('lead', fn (Builder $lead) => $lead->visibleTo($user));
    }
}
