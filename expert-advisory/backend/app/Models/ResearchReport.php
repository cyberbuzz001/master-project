<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'uuid',
    'report_code',
    'title',
    'report_type',
    'category',
    'current_version_id',
    'archive_status',
    'is_demo',
])]
class ResearchReport extends Model
{
    use HasDemoFlag, HasFactory, SoftDeletes;

    public const TYPE_FUNDAMENTAL = 'fundamental';
    public const TYPE_TECHNICAL = 'technical';
    public const TYPE_THEMATIC = 'thematic';
    public const TYPE_MACRO = 'macro';
    public const TYPE_SECTOR = 'sector';

    public const TYPES = [
        self::TYPE_TECHNICAL => 'Technical Research',
        self::TYPE_FUNDAMENTAL => 'Fundamental Research',
        self::TYPE_THEMATIC => 'Thematic Report',
        self::TYPE_MACRO => 'Macroeconomic Outlook',
        self::TYPE_SECTOR => 'Sector Report',
    ];

    public const CATEGORY_RECOMMENDATION = 'recommendation';
    public const CATEGORY_RESEARCH_REPORT = 'research_report';
    public const CATEGORY_EDUCATIONAL = 'educational';

    public const CATEGORIES = [
        self::CATEGORY_RESEARCH_REPORT => 'Research Report',
        self::CATEGORY_RECOMMENDATION => 'Trading Recommendation',
        self::CATEGORY_EDUCATIONAL => 'Educational / Informational',
    ];

    protected static function booted(): void
    {
        static::creating(function (ResearchReport $report) {
            if (empty($report->uuid)) {
                $report->uuid = (string) Str::uuid();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'is_demo' => 'boolean',
        ];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(ResearchVersion::class)->orderBy('version');
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(ResearchVersion::class, 'current_version_id');
    }
}
