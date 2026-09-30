<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiToolCall extends Model
{
    use HasFactory;

    protected $fillable = [
        'ai_run_id',
        'tool_name',
        'arguments_hash',
        'arguments',
        'result',
        'duration_ms',
        'is_allowed',
        'blocked_reason',
    ];

    protected $casts = [
        'arguments' => 'array',
        'result' => 'array',
        'is_allowed' => 'boolean',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(AiRun::class, 'ai_run_id');
    }
}
