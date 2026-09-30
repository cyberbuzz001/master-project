<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'name', 'category', 'summary', 'description', 'is_active', 'sort_order'])]
class Service extends Model
{
    public const CATEGORIES = [
        'research' => 'Research',
        'advisory' => 'Advisory',
        'education' => 'Education',
        'other' => 'Other',
    ];

    protected $attributes = ['category' => 'research', 'is_active' => true];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function plans(): HasMany
    {
        return $this->hasMany(Plan::class)->orderBy('sort_order');
    }
}
