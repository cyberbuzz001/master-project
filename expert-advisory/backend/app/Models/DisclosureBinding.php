<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'research_version_id',
    'regulatory_profile_version_id',
    'disclosures',
    'disclosure_hash',
    'conflict_of_interest_declared',
    'conflict_details',
])]
class DisclosureBinding extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'disclosures' => 'array',
            'conflict_of_interest_declared' => 'boolean',
        ];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(ResearchVersion::class, 'research_version_id');
    }

    public function regulatoryProfileVersion(): BelongsTo
    {
        return $this->belongsTo(RegulatoryProfileVersion::class, 'regulatory_profile_version_id');
    }
}
