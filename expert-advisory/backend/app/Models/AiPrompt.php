<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiPrompt extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'title',
        'description',
        'target_agent',
        'active_version_id',
    ];

    public function activeVersion(): BelongsTo
    {
        return $this->belongsTo(AiPromptVersion::class, 'active_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AiPromptVersion::class);
    }
}
