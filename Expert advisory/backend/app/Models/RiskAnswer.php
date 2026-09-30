<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['risk_profile_id', 'risk_question_id', 'question_code', 'selected_values', 'answer_label', 'score_awarded'])]
class RiskAnswer extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['selected_values' => 'array', 'created_at' => 'datetime'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(RiskQuestion::class, 'risk_question_id');
    }
}
