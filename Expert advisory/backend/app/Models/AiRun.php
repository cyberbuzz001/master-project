<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class AiRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'agent',
        'user_id',
        'ai_model_id',
        'ai_prompt_version_id',
        'status',
        'input_tokens',
        'output_tokens',
        'estimated_cost_paise',
        'latency_ms',
        'input_context',
        'raw_output',
        'structured_output',
        'grounding_passed',
        'grounding_violations',
        'failure_reason',
    ];

    protected $casts = [
        'input_context' => 'array',
        'structured_output' => 'array',
        'grounding_violations' => 'array',
        'grounding_passed' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (AiRun $run): void {
            if (empty($run->uuid)) {
                $run->uuid = (string) Str::uuid();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(AiModel::class, 'ai_model_id');
    }

    public function promptVersion(): BelongsTo
    {
        return $this->belongsTo(AiPromptVersion::class, 'ai_prompt_version_id');
    }

    public function toolCalls(): HasMany
    {
        return $this->hasMany(AiToolCall::class);
    }
}
