<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'research_version_id',
    'client_id',
    'channel',
    'sent_at',
    'delivery_status',
    'skip_reason',
])]
class ResearchDistribution extends Model
{
    use HasFactory;

    public const CHANNEL_PORTAL = 'PORTAL';
    public const CHANNEL_EMAIL = 'EMAIL';
    public const CHANNEL_WHATSAPP = 'WHATSAPP';

    public const STATUS_QUEUED = 'QUEUED';
    public const STATUS_DELIVERED = 'DELIVERED';
    public const STATUS_FAILED = 'FAILED';
    public const STATUS_SKIPPED_SUITABILITY = 'SKIPPED_SUITABILITY';
    public const STATUS_SKIPPED_CONSENT = 'SKIPPED_CONSENT';

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(ResearchVersion::class, 'research_version_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
