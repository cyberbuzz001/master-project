<?php

namespace Tests\Feature;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\Shared\ApiException;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use Database\Seeders\PolicyDocumentSeeder;
use LogicException;
use Tests\TestCase;

class ComplianceTest extends TestCase
{
    private function completeProfile(array $overrides = []): array
    {
        return array_merge([
            'entity_type' => 'sebi_registered_ra',
            'legal_entity_name' => 'Example Research Pvt Ltd',
            'registration_number' => 'INH000000000',
            'registration_date' => '2024-01-15',
            'ra_name' => 'A. Analyst',
            'compliance_officer' => 'C. Officer',
            'grievance_officer_name' => 'G. Officer',
            'grievance_officer_email' => 'grievance@example.test',
            'public_statement' => 'Test statement',
            'review_due_at' => now()->addMonths(6)->toDateString(),
        ], $overrides);
    }

    public function test_trust_center_hides_unverified_profile(): void
    {
        $editor = $this->makeStaff('compliance_admin');
        $this->actingAsVerified($editor)->postJson('/api/v1/admin/regulatory-profile/versions', $this->completeProfile())->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->flushSession();

        $this->getJson('/api/v1/public/trust-center')
            ->assertOk()
            ->assertJsonPath('data.verified', false)
            ->assertJsonPath('data.regulatory', null)
            ->assertDontSee('INH000000000');
    }

    public function test_profile_lifecycle_enforces_completeness_and_separation_of_duties(): void
    {
        $editor = $this->makeStaff('compliance_admin');
        $verifier = $this->makeStaff('compliance_admin');

        $this->actingAsVerified($editor);
        $id = $this->postJson('/api/v1/admin/regulatory-profile/versions', ['entity_type' => 'sebi_registered_ra', 'legal_entity_name' => 'X'])
            ->assertCreated()->json('data.id');

        $this->assertApiError($this->postJson("/api/v1/admin/regulatory-profile/versions/{$id}/submit"), 422, 'REGULATORY_PROFILE_INCOMPLETE');

        $this->patchJson("/api/v1/admin/regulatory-profile/versions/{$id}", $this->completeProfile())->assertOk();
        $this->postJson("/api/v1/admin/regulatory-profile/versions/{$id}/submit")->assertOk()->assertJsonPath('data.status', 'pending_verification');

        $this->assertApiError(
            $this->postJson("/api/v1/admin/regulatory-profile/versions/{$id}/verify", ['verification_evidence' => 'Checked SEBI intermediary register']),
            403,
            'SEPARATION_OF_DUTIES',
        );

        $this->actingAsVerified($verifier);
        $this->postJson("/api/v1/admin/regulatory-profile/versions/{$id}/verify", ['verification_evidence' => 'Checked SEBI intermediary register'])
            ->assertOk()
            ->assertJsonPath('data.status', 'verified');

        $this->getJson('/api/v1/public/trust-center')
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.regulatory.registration_number', 'INH000000000')
            ->assertJsonMissingPath('data.regulatory.verification_evidence');
    }

    public function test_technology_platform_cannot_record_a_registration_number(): void
    {
        $this->actingAsVerified($this->makeStaff('compliance_admin'));
        $id = $this->postJson('/api/v1/admin/regulatory-profile/versions', $this->completeProfile(['entity_type' => 'technology_platform']))
            ->assertCreated()->json('data.id');

        $response = $this->postJson("/api/v1/admin/regulatory-profile/versions/{$id}/submit");
        $this->assertApiError($response, 422, 'REGULATORY_PROFILE_INCOMPLETE');
        $response->assertJsonStructure(['errors' => ['registration_number']]);
    }

    public function test_verified_profile_is_immutable(): void
    {
        $profile = new RegulatoryProfileVersion($this->completeProfile());
        $profile->forceFill(['version' => 1, 'status' => RegulatoryProfileVersion::VERIFIED])->save();

        $this->expectException(LogicException::class);
        $profile->update(['registration_number' => 'INH999999999']);
    }

    public function test_publication_gate_fails_closed_without_verified_profile_and_policies(): void
    {
        $gate = app(ComplianceGate::class);

        try {
            $gate->assertCanPublish(ComplianceGate::CATEGORY_RECOMMENDATION);
            $this->fail('Gate should have refused publication.');
        } catch (ApiException $e) {
            $this->assertSame('COMPLIANCE_CONFIGURATION_INCOMPLETE', $e->errorCode);
            $this->assertArrayHasKey('profile_verified', $e->errors);
            $this->assertArrayHasKey('required_policies', $e->errors);
        }
    }

    public function test_publication_gate_refuses_recommendations_for_technology_platform(): void
    {
        $this->seed(PolicyDocumentSeeder::class);
        $creator = $this->makeStaff('compliance_admin');
        $verifier = $this->makeStaff('compliance_admin');

        $profile = new RegulatoryProfileVersion($this->completeProfile(['entity_type' => 'technology_platform', 'registration_number' => null, 'registration_date' => null]));
        $profile->forceFill(['version' => 1, 'status' => RegulatoryProfileVersion::VERIFIED, 'created_by' => $creator->id, 'verified_by' => $verifier->id, 'verified_at' => now()])->save();

        foreach (ComplianceGate::REQUIRED_POLICIES as $slug) {
            PolicyDocumentVersion::query()->whereHas('document', fn ($q) => $q->where('slug', $slug))->update(['status' => 'published', 'published_at' => now()]);
        }

        $gate = app(ComplianceGate::class);
        $gate->assertCanPublish(ComplianceGate::CATEGORY_EDUCATIONAL);

        $this->expectException(ApiException::class);
        $gate->assertCanPublish(ComplianceGate::CATEGORY_RECOMMENDATION);
    }

    public function test_policy_draft_is_not_public_until_approved_and_published_by_workflow(): void
    {
        $this->seed(PolicyDocumentSeeder::class);

        $this->assertApiError($this->getJson('/api/v1/public/policies/privacy-policy'), 404, 'POLICY_NOT_PUBLISHED');

        $author = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('compliance_admin');

        $this->actingAsVerified($author);
        $versionId = $this->postJson('/api/v1/admin/policies/privacy-policy/versions', [
            'body_markdown' => "# Privacy Policy\n\nReviewed text approved by counsel.",
            'change_summary' => 'Counsel review',
        ])->assertCreated()->assertJsonPath('data.version', 2)->json('data.id');

        $this->assertApiError($this->postJson("/api/v1/admin/policies/versions/{$versionId}/approve"), 403, 'SEPARATION_OF_DUTIES');
        $this->assertApiError($this->postJson("/api/v1/admin/policies/versions/{$versionId}/publish"), 400, 'INVALID_STATE_TRANSITION');

        $this->actingAsVerified($approver);
        $this->postJson("/api/v1/admin/policies/versions/{$versionId}/approve")->assertOk();
        $this->postJson("/api/v1/admin/policies/versions/{$versionId}/publish")->assertOk()->assertJsonPath('data.status', 'published');

        $this->getJson('/api/v1/public/policies/privacy-policy')
            ->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertSee('Reviewed text approved by counsel.');
    }

    public function test_published_policy_content_is_immutable(): void
    {
        $this->seed(PolicyDocumentSeeder::class);
        $version = PolicyDocumentVersion::query()->firstOrFail();
        $version->forceFill(['status' => PolicyDocumentVersion::PUBLISHED])->save();

        $this->expectException(LogicException::class);
        $version->update(['body_markdown' => 'Silently changed']);
    }

    public function test_seeded_policies_are_drafts_and_never_claim_registration(): void
    {
        $this->seed(PolicyDocumentSeeder::class);

        $this->assertSame(0, PolicyDocumentVersion::query()->where('status', '!=', 'draft')->count());

        foreach (PolicyDocumentVersion::all() as $version) {
            $this->assertStringContainsString('DRAFT', $version->body_markdown);
            $this->assertDoesNotMatchRegularExpression('/\bIN[AHZ]\d{9}\b/', $version->body_markdown);
            $this->assertStringNotContainsStringIgnoringCase('guaranteed return', $version->body_markdown);
        }
    }
}
