<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['training_module_id', 'module_version', 'user_id', 'ip', 'acknowledged_at'])]
class TrainingAcknowledgement extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['acknowledged_at' => 'datetime'];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(TrainingModule::class, 'training_module_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
