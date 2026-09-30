<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class MessageLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'channel',
        'recipient_type',
        'recipient_id',
        'recipient_email',
        'recipient_phone',
        'template_id',
        'rendered_subject',
        'rendered_body',
        'consent_verified',
        'status',
        'provider_message_id',
        'sent_at',
        'error_message',
    ];

    protected $casts = [
        'consent_verified' => 'boolean',
        'sent_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (MessageLog $log): void {
            if (empty($log->uuid)) {
                $log->uuid = (string) Str::uuid();
            }
        });
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(MessageTemplate::class, 'template_id');
    }
}
