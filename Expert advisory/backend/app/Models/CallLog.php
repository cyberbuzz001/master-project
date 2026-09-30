<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['lead_id', 'employee_id', 'direction', 'outcome', 'duration_seconds', 'notes', 'called_at', 'is_demo'])]
class CallLog extends Model
{
    use HasDemoFlag;

    public const OUTCOMES = [
        'connected' => 'Connected',
        'no_answer' => 'No answer',
        'busy' => 'Busy',
        'switched_off' => 'Switched off / unreachable',
        'callback_requested' => 'Asked to call back',
        'not_interested' => 'Not interested',
        'wrong_number' => 'Wrong number',
    ];

    protected function casts(): array
    {
        return ['called_at' => 'datetime', 'is_demo' => 'boolean'];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
