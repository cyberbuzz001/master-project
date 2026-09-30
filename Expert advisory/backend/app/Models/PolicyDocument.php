<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['slug', 'title', 'category', 'is_public', 'requires_consent'])]
class PolicyDocument extends Model
{
    protected function casts(): array
    {
        return ['is_public' => 'boolean', 'requires_consent' => 'boolean'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(PolicyDocumentVersion::class)->orderByDesc('version');
    }

    public function publishedVersion(): HasOne
    {
        return $this->hasOne(PolicyDocumentVersion::class)
            ->where('status', PolicyDocumentVersion::PUBLISHED)
            ->latestOfMany('version');
    }
}
