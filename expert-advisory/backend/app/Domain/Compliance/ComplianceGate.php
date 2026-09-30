<?php

namespace App\Domain\Compliance;

use App\Domain\Shared\ApiException;
use App\Models\PolicyDocument;
use App\Models\RegulatoryProfileVersion;

/**
 * Fail-closed publication gate. Every path that publishes regulated content must call assertCanPublish().
 */
final class ComplianceGate
{
    public const CATEGORY_RECOMMENDATION = 'recommendation';

    public const CATEGORY_RESEARCH_REPORT = 'research_report';

    public const CATEGORY_EDUCATIONAL = 'educational';

    /**
     * Policy documents that must be published before any research publication.
     */
    public const REQUIRED_POLICIES = ['disclaimer', 'risk-disclosure', 'grievance-redressal', 'research-methodology'];

    public function __construct(private readonly RegulatoryProfileService $profiles) {}

    public function assertCanPublish(string $category): void
    {
        $failed = array_filter($this->readiness($category), fn (array $check) => ! $check['passed']);

        if ($failed !== []) {
            $errors = [];
            foreach ($failed as $check) {
                $errors[$check['key']] = [$check['detail']];
            }

            throw ApiException::unprocessable(
                'COMPLIANCE_CONFIGURATION_INCOMPLETE',
                'Publication is blocked until the compliance configuration is complete and verified.',
                $errors,
            );
        }
    }

    /**
     * @return list<array{key: string, label: string, passed: bool, detail: string}>
     */
    public function readiness(string $category = self::CATEGORY_RESEARCH_REPORT): array
    {
        $profile = $this->profiles->active();
        $checks = [];

        $checks[] = self::check('profile_verified', 'Verified regulatory profile', $profile !== null,
            $profile ? "Version {$profile->version} verified on {$profile->verified_at?->toDateString()}." : 'No verified regulatory profile exists.');

        if ($profile !== null) {
            $checks[] = self::check('separation_of_duties', 'Verified by a different person', $profile->verified_by !== $profile->created_by,
                'Profile author and verifier must be different people.');

            $reviewOk = $profile->review_due_at !== null && ! $profile->review_due_at->endOfDay()->isPast();
            $checks[] = self::check('review_current', 'Regulatory review not overdue', $reviewOk,
                $reviewOk ? "Next review due {$profile->review_due_at->toDateString()}." : 'The regulatory profile review date has passed.');

            $problems = RegulatoryProfileRules::completenessProblems($profile);
            unset($problems['review_due_at']);
            $checks[] = self::check('profile_complete', 'Required registration details present', $problems === [],
                $problems === [] ? 'All required fields for the entity type are present.' : implode(' ', array_merge(...array_values($problems))));

            if ($category !== self::CATEGORY_EDUCATIONAL) {
                $allowed = RegulatoryProfileRules::canPublishRecommendations($profile);
                $checks[] = self::check('entity_may_publish_research', 'Entity type may publish research', $allowed,
                    $allowed ? 'Entity type permits research publication.' : 'This entity type may publish educational content only.');
            }
        }

        $published = PolicyDocument::query()->whereIn('slug', self::REQUIRED_POLICIES)->whereHas('publishedVersion')->pluck('slug')->all();
        $missing = array_values(array_diff(self::REQUIRED_POLICIES, $published));
        $checks[] = self::check('required_policies', 'Required disclosures published', $missing === [],
            $missing === [] ? 'All required disclosures are published.' : 'Unpublished: '.implode(', ', $missing).'.');

        return $checks;
    }

    /**
     * Only verified information, safe for the public Trust Center.
     *
     * @return array<string, mixed>|null
     */
    public function publicRegulatoryInfo(): ?array
    {
        $profile = $this->profiles->active();

        if ($profile === null) {
            return null;
        }

        $partner = $profile->partner_ra ?? [];

        return [
            'entity_type' => $profile->entity_type,
            'entity_type_label' => RegulatoryProfileVersion::ENTITY_TYPES[$profile->entity_type] ?? null,
            'legal_entity_name' => $profile->legal_entity_name,
            'brand_name' => $profile->brand_name,
            'research_status' => $profile->research_status,
            'registration_number' => $profile->registration_number,
            'registration_date' => $profile->registration_date?->toDateString(),
            'registration_valid_until' => $profile->registration_valid_until?->toDateString(),
            'ra_name' => $profile->ra_name,
            'ra_contact_email' => $profile->ra_contact_email,
            'principal_officer' => $profile->principal_officer,
            'compliance_officer' => $profile->compliance_officer,
            'grievance_officer' => [
                'name' => $profile->grievance_officer_name,
                'email' => $profile->grievance_officer_email,
                'phone' => $profile->grievance_officer_phone,
            ],
            'partner_ra' => $partner === [] ? null : [
                'name' => $partner['name'] ?? null,
                'registration_number' => $partner['registration_number'] ?? null,
            ],
            'public_statement' => $profile->public_statement,
            'version' => $profile->version,
            'verified_at' => $profile->verified_at?->toIso8601String(),
            'review_due_at' => $profile->review_due_at?->toDateString(),
        ];
    }

    /**
     * @return array{key: string, label: string, passed: bool, detail: string}
     */
    private static function check(string $key, string $label, bool $passed, string $detail): array
    {
        return compact('key', 'label', 'passed', 'detail');
    }
}
