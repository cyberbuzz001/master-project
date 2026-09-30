<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['owner_type', 'owner_id', 'category', 'title', 'retention_policy', 'retain_until', 'document_expires_on', 'is_demo'])]
class Document extends Model
{
    use HasDemoFlag, SoftDeletes;

    public const PENDING = 'pending';

    public const VERIFIED = 'verified';

    public const REJECTED = 'rejected';

    public const EXPIRED = 'expired';

    protected $attributes = ['status' => self::PENDING];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
            'retain_until' => 'date',
            'document_expires_on' => 'date',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Document $document): void {
            $document->uuid ??= (string) Str::uuid7();
        });
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class)->orderByDesc('version');
    }

    public function currentVersion(): ?DocumentVersion
    {
        return $this->versions()->first();
    }

    public function accessLogs(): HasMany
    {
        return $this->hasMany(DocumentAccessLog::class)->orderByDesc('id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function ownerRecord(): ?Model
    {
        return match ($this->owner_type) {
            'client' => Client::find($this->owner_id),
            'lead' => Lead::find($this->owner_id),
            'employee' => Employee::find($this->owner_id),
            default => null,
        };
    }

    public function isExpired(): bool
    {
        return $this->document_expires_on !== null && $this->document_expires_on->isPast();
    }
}
