<?php

namespace App\Domain\Research;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\Compliance\RegulatoryProfileService;
use App\Models\DisclosureBinding;
use App\Models\RegulatoryProfileVersion;
use App\Models\ResearchVersion;

class DisclosureEngine
{
    public const STANDARD_MARKET_DISCLAIMER = 'Investments in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.';

    public function __construct(
        protected RegulatoryProfileService $profiles,
        protected ComplianceGate $complianceGate,
    ) {}

    /**
     * Build standard disclosures and bind them to the research version.
     *
     * @param array{
     *     has_financial_interest?: bool,
     *     has_beneficial_ownership?: bool,
     *     has_conflict_of_interest?: bool,
     *     conflict_details?: string|null,
     * } $declarations
     */
    public function bindDisclosures(ResearchVersion $version, array $declarations = []): DisclosureBinding
    {
        $activeProfile = $this->profiles->active();
        $regInfo = $this->complianceGate->publicRegulatoryInfo();

        $disclosures = [
            'entity' => [
                'legal_name' => $regInfo['legal_entity_name'] ?? 'Expert Stocks Consultancy',
                'brand_name' => $regInfo['brand_name'] ?? 'Expert Stocks',
                'registration_number' => $regInfo['registration_number'] ?? null,
                'entity_type' => $regInfo['entity_type_label'] ?? null,
            ],
            'grievance_officer' => $regInfo['grievance_officer'] ?? null,
            'statutory_disclaimer' => self::STANDARD_MARKET_DISCLAIMER,
            'analyst_declarations' => [
                'financial_interest' => (bool) ($declarations['has_financial_interest'] ?? false),
                'beneficial_ownership_1_percent_or_more' => (bool) ($declarations['has_beneficial_ownership'] ?? false),
                'material_conflict_of_interest' => (bool) ($declarations['has_conflict_of_interest'] ?? false),
                'conflict_details' => $declarations['conflict_details'] ?? null,
            ],
            'methodology_statement' => 'Research recommendations are generated based on published quantitative indicators and technical chart analysis in accordance with our documented Research Methodology Policy.',
        ];

        $json = json_encode($disclosures, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $hash = hash('sha256', $json);

        // Delete existing binding if any (before publication)
        $version->disclosureBinding()?->delete();

        $binding = DisclosureBinding::create([
            'research_version_id' => $version->id,
            'regulatory_profile_version_id' => $activeProfile?->id ?? 1,
            'disclosures' => $disclosures,
            'disclosure_hash' => $hash,
            'conflict_of_interest_declared' => (bool) ($declarations['has_conflict_of_interest'] ?? false),
            'conflict_details' => $declarations['conflict_details'] ?? null,
        ]);

        $version->forceFill(['disclosure_set_hash' => $hash])->save();

        return $binding;
    }
}
