<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['risk_questionnaire_version_id', 'code', 'text', 'help_text', 'type', 'weight', 'sort_order', 'is_required'])]
class RiskQuestion extends Model
{
    public const SINGLE = 'single_choice';

    public const MULTI = 'multi_choice';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['is_required' => 'boolean'];
    }

    public function questionnaireVersion(): BelongsTo
    {
        return $this->belongsTo(RiskQuestionnaireVersion::class, 'risk_questionnaire_version_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(RiskQuestionOption::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Highest score this question can contribute: the best option, or every positive option when
     * several may be chosen.
     */
    public function maxScore(): int
    {
        $scores = $this->options->pluck('score');

        $best = $this->type === self::MULTI
            ? $scores->filter(fn (int $score) => $score > 0)->sum()
            : (int) $scores->max();

        return $best * $this->weight;
    }
}
