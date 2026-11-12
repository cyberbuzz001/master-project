<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class LeadImportPreview extends Model
{
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['payload' => 'array', 'expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $preview): void {
            $preview->id ??= (string) Str::uuid();
        });
    }
}
