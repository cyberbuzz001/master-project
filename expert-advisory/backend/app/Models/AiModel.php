<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiModel extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'provider',
        'model_identifier',
        'input_cost_per_million_paise',
        'output_cost_per_million_paise',
        'is_active',
        'parameters',
    ];

    protected $casts = [
        'input_cost_per_million_paise' => 'decimal:2',
        'output_cost_per_million_paise' => 'decimal:2',
        'is_active' => 'boolean',
        'parameters' => 'array',
    ];

    public function runs(): HasMany
    {
        return $this->hasMany(AiRun::class);
    }
}
