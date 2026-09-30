<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'title', 'description', 'is_active'])]
class RiskQuestionnaire extends Model
{
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(RiskQuestionnaireVersion::class)->orderByDesc('version');
    }

    public function publishedVersion(): ?RiskQuestionnaireVersion
    {
        return $this->versions()->where('status', RiskQuestionnaireVersion::PUBLISHED)->first();
    }
}
