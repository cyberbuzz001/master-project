<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class LeadImportBatch extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'valid_count' => 'integer',
            'name_and_phone_count' => 'integer',
            'phone_only_count' => 'integer',
            'duplicate_count' => 'integer',
            'invalid_count' => 'integer',
            'accepted_count' => 'integer',
            'uncertain_ocr_count' => 'integer',
            'consent_verified_count' => 'integer',
            'consent_whatsapp' => 'boolean',
            'consent_calls' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (LeadImportBatch $batch): void {
            $batch->uuid ??= (string) Str::uuid7();
            $batch->batch_code ??= 'LIB-' . date('Ymd') . '-' . strtoupper(Str::random(5));
        });
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'lead_import_batch_id');
    }
}
