<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiPromptVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'ai_prompt_id',
        'version_number',
        'system_prompt',
        'input_schema',
        'output_schema',
        'status',
        'author_id',
        'approved_by_id',
        'approved_at',
        'change_reason',
    ];

    protected $casts = [
        'input_schema' => 'array',
        'output_schema' => 'array',
        'approved_at' => 'datetime',
    ];

    public function prompt(): BelongsTo
    {
        return $this->belongsTo(AiPrompt::class, 'ai_prompt_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_id');
    }
}
