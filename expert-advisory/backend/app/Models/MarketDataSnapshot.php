<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'provider',
    'dataset',
    'symbol',
    'exchange',
    'payload_sha256',
    'payload',
    'as_of',
    'retrieved_at',
    'is_stale',
])]
class MarketDataSnapshot extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'as_of' => 'datetime',
            'retrieved_at' => 'datetime',
            'is_stale' => 'boolean',
        ];
    }

    public function researchVersions(): HasMany
    {
        return $this->hasMany(ResearchVersion::class, 'data_snapshot_id');
    }

    public function checkStale(?int $maxAgeSeconds = null): bool
    {
        if ($this->is_stale) {
            return true;
        }

        if ($this->as_of === null) {
            return true;
        }

        $maxAge = $maxAgeSeconds ?? (int) config('market_data.stale_threshold_seconds', 900);
        $asOfTs = CarbonImmutable::parse($this->as_of)->getTimestamp();
        $nowTs = CarbonImmutable::now()->getTimestamp();
        $diff = $nowTs - $asOfTs;

        if ($diff > $maxAge) {
            $this->update(['is_stale' => true]);
            return true;
        }

        return false;
    }
}
