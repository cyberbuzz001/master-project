<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable([
    'entity_type', 'legal_entity_name', 'brand_name', 'research_status', 'registration_number', 'registration_date',
    'registration_valid_until', 'ra_name', 'ra_contact_email', 'ra_contact_phone', 'principal_officer', 'compliance_officer',
    'grievance_officer_name', 'grievance_officer_email', 'grievance_officer_phone', 'raasb_details', 'partner_ra',
    'authorized_persons', 'applicable_disclosures', 'advertising_rules', 'research_approval_required',
    'personalized_advice_allowed', 'performance_claim_policy', 'whatsapp_policy', 'email_policy', 'public_statement',
    'review_due_at', 'verification_evidence',
])]
class RegulatoryProfileVersion extends Model
{
    public const DRAFT = 'draft';

    public const PENDING = 'pending_verification';

    public const VERIFIED = 'verified';

    public const SUPERSEDED = 'superseded';

    public const REJECTED = 'rejected';

    public const ENTITY_TYPES = [
        'sebi_registered_ra' => 'SEBI Registered Research Analyst',
        'research_entity' => 'Research Entity',
        'partner_associated_ra' => 'Partner / Associated Research Analyst',
        'technology_platform' => 'Technology Platform',
        'marketing_distribution' => 'Marketing / Distribution Entity',
        'other' => 'Other',
    ];

    protected function casts(): array
    {
        return [
            'registration_date' => 'date',
            'registration_valid_until' => 'date',
            'raasb_details' => 'array',
            'partner_ra' => 'array',
            'authorized_persons' => 'array',
            'applicable_disclosures' => 'array',
            'advertising_rules' => 'array',
            'whatsapp_policy' => 'array',
            'email_policy' => 'array',
            'research_approval_required' => 'boolean',
            'personalized_advice_allowed' => 'boolean',
            'review_due_at' => 'date',
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Verified, superseded and rejected versions are historical records. The only permitted
        // change is marking a verified version superseded when a newer version is verified.
        static::updating(function (RegulatoryProfileVersion $version): void {
            $original = $version->getOriginal('status');

            if (! in_array($original, [self::VERIFIED, self::SUPERSEDED, self::REJECTED], true)) {
                return;
            }

            $isSupersede = $original === self::VERIFIED
                && $version->status === self::SUPERSEDED
                && array_diff(array_keys($version->getDirty()), ['status', 'superseded_at', 'updated_at']) === [];

            if (! $isSupersede) {
                throw new LogicException('Verified regulatory profile versions are immutable. Create a new version.');
            }
        });

        static::deleting(function (RegulatoryProfileVersion $version): void {
            if ($version->status !== self::DRAFT) {
                throw new LogicException('Only draft regulatory profile versions can be deleted.');
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
