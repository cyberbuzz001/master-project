<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'title', 'description', 'requires_client_acceptance', 'is_active'])]
class Agreement extends Model
{
    protected function casts(): array
    {
        return ['requires_client_acceptance' => 'boolean', 'is_active' => 'boolean'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AgreementVersion::class)->orderByDesc('version');
    }

    public function publishedVersion(): ?AgreementVersion
    {
        return $this->versions()->where('status', AgreementVersion::PUBLISHED)->first();
    }
}
