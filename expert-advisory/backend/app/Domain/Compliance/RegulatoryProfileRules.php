<?php

namespace App\Domain\Compliance;

use App\Models\RegulatoryProfileVersion;

/**
 * Completeness rules per entity type. Deliberately strict: missing data blocks verification,
 * it is never defaulted.
 */
final class RegulatoryProfileRules
{
    /**
     * @return array<string, list<string>> field => messages
     */
    public static function completenessProblems(RegulatoryProfileVersion $profile): array
    {
        $problems = [];
        $require = function (string $field, mixed $value, string $label) use (&$problems): void {
            if ($value === null || $value === '' || $value === []) {
                $problems[$field][] = "{$label} is required.";
            }
        };

        $require('entity_type', $profile->entity_type, 'Entity type');
        $require('legal_entity_name', $profile->legal_entity_name, 'Legal entity name');
        $require('review_due_at', $profile->review_due_at, 'Next review date');
        $require('grievance_officer_name', $profile->grievance_officer_name, 'Grievance officer name');
        $require('grievance_officer_email', $profile->grievance_officer_email, 'Grievance officer email');

        if (! array_key_exists((string) $profile->entity_type, RegulatoryProfileVersion::ENTITY_TYPES)) {
            $problems['entity_type'][] = 'Entity type is not recognised.';
        }

        if ($profile->entity_type === 'sebi_registered_ra') {
            $require('registration_number', $profile->registration_number, 'SEBI registration number');
            $require('registration_date', $profile->registration_date, 'Registration date');
            $require('ra_name', $profile->ra_name, 'Research Analyst name');
            $require('compliance_officer', $profile->compliance_officer, 'Compliance officer');
        }

        if ($profile->entity_type === 'partner_associated_ra') {
            $partner = $profile->partner_ra ?? [];
            $require('partner_ra.name', $partner['name'] ?? null, 'Partner RA legal name');
            $require('partner_ra.registration_number', $partner['registration_number'] ?? null, 'Partner RA registration number');
            $require('partner_ra.agreement_reference', $partner['agreement_reference'] ?? null, 'Partner agreement reference');
        }

        if ($profile->registration_number !== null && $profile->entity_type !== 'sebi_registered_ra' && $profile->entity_type !== 'research_entity') {
            $problems['registration_number'][] = 'A registration number may only be recorded for a registered research entity. Record a partner RA under partner details.';
        }

        if ($profile->review_due_at !== null && $profile->review_due_at->isPast()) {
            $problems['review_due_at'][] = 'Next review date must be in the future.';
        }

        return $problems;
    }

    /**
     * Whether this entity type can ever publish research recommendations.
     */
    public static function canPublishRecommendations(RegulatoryProfileVersion $profile): bool
    {
        return in_array($profile->entity_type, ['sebi_registered_ra', 'research_entity', 'partner_associated_ra'], true);
    }
}
