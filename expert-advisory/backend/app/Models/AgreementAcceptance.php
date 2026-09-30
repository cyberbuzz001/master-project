<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['client_id', 'agreement_version_id', 'method', 'accepted_by_user_id', 'recorded_by', 'document_id', 'ip', 'user_agent'])]
class AgreementAcceptance extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (AgreementAcceptance $acceptance): void {
            $acceptance->uuid ??= (string) Str::uuid7();
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function agreementVersion(): BelongsTo
    {
        return $this->belongsTo(AgreementVersion::class);
    }
}
