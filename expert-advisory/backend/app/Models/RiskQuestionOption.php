<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['risk_question_id', 'label', 'value', 'score', 'suitability_flags', 'sort_order'])]
class RiskQuestionOption extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['suitability_flags' => 'array'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(RiskQuestion::class, 'risk_question_id');
    }
}
