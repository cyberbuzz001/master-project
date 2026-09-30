<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['client_id', 'plan_version_id', 'invoice_id', 'starts_on', 'ends_on', 'is_demo'])]
class Subscription extends Model
{
    use HasDemoFlag;

    public const PENDING_ACTIVATION = 'pending_activation';

    public const ACTIVE = 'active';

    public const PAUSED = 'paused';

    public const EXPIRED = 'expired';

    public const CANCELLED = 'cancelled';

    protected $attributes = ['status' => self::PENDING_ACTIVATION];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'activated_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Subscription $subscription): void {
            $subscription->uuid ??= (string) Str::uuid7();
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(PlanVersion::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function isRunning(): bool
    {
        return $this->status === self::ACTIVE && ($this->ends_on === null || ! $this->ends_on->isPast());
    }

    public function daysRemaining(): ?int
    {
        return $this->ends_on === null ? null : (int) now()->startOfDay()->diffInDays($this->ends_on->endOfDay(), false);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('subscriptions.view')) {
            return $query->whereIn('client_id', Client::query()->visibleTo($user)->select('id'));
        }

        $client = $user->client;

        return $client === null ? $query->whereRaw('1 = 0') : $query->where('client_id', $client->id);
    }
}
