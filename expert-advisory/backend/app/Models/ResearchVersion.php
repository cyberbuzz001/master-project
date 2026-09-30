<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use LogicException;

#[Fillable([
    'research_report_id',
    'version',
    'status',
    'title',
    'summary',
    'body',
    'sections',
    'author_employee_id',
    'ai_run_id',
    'prompt_version',
    'data_snapshot_id',
    'regulatory_profile_version_id',
    'disclosure_set_hash',
    'content_hash',
    'compliance_reviewer_id',
    'compliance_reviewed_at',
    'compliance_comment',
    'approver_id',
    'approved_at',
    'approval_comment',
    'published_at',
    'publisher_id',
    'valid_until',
    'rejection_reason',
])]
class ResearchVersion extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'DRAFT';
    public const STATUS_AI_REVIEW = 'AI_REVIEW';
    public const STATUS_COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW';
    public const STATUS_ANALYST_REVIEW = 'ANALYST_REVIEW';
    public const STATUS_APPROVED = 'APPROVED';
    public const STATUS_PUBLISHED = 'PUBLISHED';
    public const STATUS_REJECTED = 'REJECTED';
    public const STATUS_EXPIRED = 'EXPIRED';
    public const STATUS_ARCHIVED = 'ARCHIVED';

    public const STATUSES = [
        self::STATUS_DRAFT => 'Draft',
        self::STATUS_AI_REVIEW => 'AI Review',
        self::STATUS_COMPLIANCE_REVIEW => 'Compliance Review',
        self::STATUS_ANALYST_REVIEW => 'Analyst Review',
        self::STATUS_APPROVED => 'Approved',
        self::STATUS_PUBLISHED => 'Published',
        self::STATUS_REJECTED => 'Rejected',
        self::STATUS_EXPIRED => 'Expired',
        self::STATUS_ARCHIVED => 'Archived',
    ];

    protected static function booted(): void
    {
        static::updating(function (ResearchVersion $version) {
            // Once published, core contents and published attributes cannot be modified.
            // Transitions to EXPIRED or ARCHIVED are allowed.
            if ($version->getOriginal('status') === self::STATUS_PUBLISHED) {
                $dirty = array_keys($version->getDirty());
                $allowed = ['status', 'updated_at'];
                if (array_diff($dirty, $allowed) !== []) {
                    throw new LogicException('A published research version is immutable.');
                }
            }
        });

        static::deleting(function (ResearchVersion $version) {
            if ($version->getOriginal('status') === self::STATUS_PUBLISHED) {
                throw new LogicException('A published research version cannot be deleted.');
            }
        });
    }

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'sections' => 'array',
            'compliance_reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'valid_until' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(ResearchReport::class, 'research_report_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'author_employee_id');
    }

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(MarketDataSnapshot::class, 'data_snapshot_id');
    }

    public function complianceReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'compliance_reviewer_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'publisher_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(ResearchRecommendation::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(ResearchApproval::class)->orderBy('id');
    }

    public function disclosureBinding(): HasOne
    {
        return $this->hasOne(DisclosureBinding::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(ResearchDistribution::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
