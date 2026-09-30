<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'research_version_id',
    'stage',
    'action',
    'actor_user_id',
    'actor_employee_id',
    'comments',
    'payload',
    'created_at',
])]
class ResearchApproval extends Model
{
    use HasFactory;

    public $timestamps = false;

    public const STAGE_SUBMISSION = 'SUBMISSION';
    public const STAGE_AI_REVIEW = 'AI_REVIEW';
    public const STAGE_COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW';
    public const STAGE_ANALYST_REVIEW = 'ANALYST_REVIEW';
    public const STAGE_PUBLICATION = 'PUBLICATION';

    public const ACTION_SUBMIT = 'SUBMIT';
    public const ACTION_CLEAR = 'CLEAR';
    public const ACTION_REQUEST_CHANGES = 'REQUEST_CHANGES';
    public const ACTION_REJECT = 'REJECT';
    public const ACTION_APPROVE = 'APPROVE';
    public const ACTION_PUBLISH = 'PUBLISH';

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(ResearchVersion::class, 'research_version_id');
    }

    public function actorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function actorEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'actor_employee_id');
    }
}
