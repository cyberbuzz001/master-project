<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

#[Fillable(['risk_questionnaire_id', 'version', 'methodology_version', 'bands', 'valid_for_days', 'created_by'])]
class RiskQuestionnaireVersion extends Model
{
    public const DRAFT = 'draft';

    public const PUBLISHED = 'published';

    public const RETIRED = 'retired';

    protected $attributes = ['status' => self::DRAFT];

    protected function casts(): array
    {
        return ['bands' => 'array', 'published_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        // A published questionnaire is frozen: assessments taken under it must stay reproducible.
        static::updating(function (RiskQuestionnaireVersion $version): void {
            if ($version->getOriginal('status') !== self::DRAFT
                && $version->isDirty(['bands', 'methodology_version', 'version', 'risk_questionnaire_id', 'valid_for_days'])) {
                throw new LogicException('Published questionnaires are immutable. Create a new version.');
            }
        });
    }

    public function questionnaire(): BelongsTo
    {
        return $this->belongsTo(RiskQuestionnaire::class, 'risk_questionnaire_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(RiskQuestion::class)->orderBy('sort_order')->orderBy('id');
    }

    public function profiles(): HasMany
    {
        return $this->hasMany(RiskProfile::class);
    }

    public function maxScore(): int
    {
        return $this->questions->sum(fn (RiskQuestion $question) => $question->maxScore());
    }

    /**
     * @return array{key: string, label: string, min_score: int, max_score: int, description?: string, suitability?: array}|null
     */
    public function bandFor(int $score): ?array
    {
        foreach ($this->bands ?? [] as $band) {
            if ($score >= (int) $band['min_score'] && $score <= (int) $band['max_score']) {
                return $band;
            }
        }

        return null;
    }

    public function bandLabels(): array
    {
        return collect($this->bands ?? [])->pluck('label', 'key')->all();
    }
}
