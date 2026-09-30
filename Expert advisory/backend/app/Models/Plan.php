<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['service_id', 'code', 'name', 'billing_cycle', 'duration_days', 'is_active', 'sort_order'])]
class Plan extends Model
{
    public const CYCLES = [
        'one_time' => ['label' => 'One-time', 'days' => 0],
        'monthly' => ['label' => 'Monthly', 'days' => 30],
        'quarterly' => ['label' => 'Quarterly', 'days' => 91],
        'half_yearly' => ['label' => 'Half-yearly', 'days' => 182],
        'yearly' => ['label' => 'Yearly', 'days' => 365],
    ];

    protected $attributes = ['billing_cycle' => 'monthly', 'is_active' => true];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(PlanVersion::class)->orderByDesc('version');
    }

    public function publishedVersion(): ?PlanVersion
    {
        return $this->versions()->where('status', PlanVersion::PUBLISHED)->first();
    }

    public function cycleLabel(): string
    {
        return self::CYCLES[$this->billing_cycle]['label'] ?? $this->billing_cycle;
    }
}
