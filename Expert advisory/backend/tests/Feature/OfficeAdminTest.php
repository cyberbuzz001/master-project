<?php

namespace Tests\Feature;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\AuditLogs\Pages\ManageAuditLogs;
use App\Filament\Resources\PolicyDocuments\Pages\ViewPolicyDocument;
use App\Filament\Resources\PolicyDocuments\RelationManagers\VersionsRelationManager;
use App\Filament\Resources\RegulatoryProfiles\Pages\ManageRegulatoryProfiles;
use App\Filament\Resources\SystemSettings\Pages\ManageSystemSettings;
use App\Filament\Resources\Users\Pages\ManageUsers;
use App\Models\AuditLog;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\PolicyDocumentSeeder;
use Database\Seeders\SystemSettingsSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Tests\TestCase;

class OfficeAdminTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
    }

    public function test_admin_creates_staff_user_but_cannot_grant_privileged_roles(): void
    {
        $this->actingAsVerified($this->makeStaff('admin'));

        Livewire::test(ManageUsers::class)
            ->callAction('createStaff', data: [
                'name' => 'New Advisor', 'email' => 'new.advisor@example.test', 'password' => 'Strong#Password2026',
                'roles' => ['business_advisor'], 'reason' => 'New hire',
            ])
            ->assertHasNoActionErrors();

        $created = User::query()->where('email', 'new.advisor@example.test')->sole();
        $this->assertSame(['business_advisor'], $created->getRoleNames()->all());
        $this->assertNotNull($created->employee);

        Livewire::test(ManageUsers::class)
            ->callAction('createStaff', data: [
                'name' => 'Sneaky', 'email' => 'sneaky@example.test', 'password' => 'Strong#Password2026',
                'roles' => ['compliance_admin'], 'reason' => 'Try',
            ]);

        // Role assignment is refused and the whole creation is rolled back.
        $this->assertDatabaseMissing('users', ['email' => 'sneaky@example.test']);
    }

    public function test_role_change_and_deactivation_are_audited_and_hidden_for_self(): void
    {
        $admin = $this->makeStaff('admin');
        $advisor = $this->makeStaff('business_advisor');
        $this->actingAsVerified($admin);

        Livewire::test(ManageUsers::class)
            ->assertActionHidden(TestAction::make('deactivate')->table($admin))
            ->assertActionHidden(TestAction::make('roles')->table($admin))
            ->callAction(TestAction::make('roles')->table($advisor), data: ['roles' => ['team_leader'], 'reason' => 'Promotion'])
            ->callAction(TestAction::make('deactivate')->table($advisor), data: ['reason' => 'Left the company']);

        $advisor->refresh();
        $this->assertSame(['team_leader'], $advisor->getRoleNames()->all());
        $this->assertSame(User::STATUS_DEACTIVATED, $advisor->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.deactivated', 'subject_id' => $advisor->id, 'reason' => 'Left the company']);
    }

    public function test_admin_screens_are_permission_gated(): void
    {
        $this->actingAsVerified($this->makeStaff('business_advisor'));
        foreach (['/office/users', '/office/audit-logs', '/office/regulatory-profile', '/office/policy-documents', '/office/system-settings', '/office/roles'] as $path) {
            $this->get($path)->assertForbidden();
        }

        $this->actingAsVerified($this->makeStaff('auditor'));
        $this->get('/office/audit-logs')->assertOk();
        $this->get('/office/roles')->assertOk();
        Livewire::test(ManageUsers::class)->assertActionHidden('createStaff');
    }

    public function test_audit_log_lists_entries(): void
    {
        $this->actingAsVerified($this->makeStaff('auditor'));
        app(AuditLogger::class)->record('test.visible_entry');

        Livewire::test(ManageAuditLogs::class)->assertCanSeeTableRecords(AuditLog::query()->where('action', 'test.visible_entry')->get());
    }

    public function test_regulatory_profile_needs_a_second_person_to_verify(): void
    {
        $author = $this->makeStaff('compliance_admin');
        $verifier = $this->makeStaff('compliance_admin');

        $this->actingAsVerified($author);
        Livewire::test(ManageRegulatoryProfiles::class)
            ->callAction('newDraft', data: [
                'entity_type' => 'partner_associated_ra',
                'legal_entity_name' => 'Example Services LLP',
                'partner_ra' => ['name' => 'Example RA', 'registration_number' => 'INH000000001', 'agreement_reference' => 'AGR-2026-01'],
                'grievance_officer_name' => 'G. Officer',
                'grievance_officer_email' => 'grievance@example.test',
                'performance_claim_policy' => 'none',
                'review_due_at' => now()->addMonths(6)->toDateString(),
            ])
            ->assertHasNoActionErrors();

        $version = RegulatoryProfileVersion::query()->sole();

        Livewire::test(ManageRegulatoryProfiles::class)
            ->callAction(TestAction::make('submit')->table($version))
            ->callAction(TestAction::make('verify')->table($version->fresh()), data: ['verification_evidence' => 'Checked partner agreement and register']);
        $this->assertSame(RegulatoryProfileVersion::PENDING, $version->fresh()->status);

        $this->actingAsVerified($verifier);
        Livewire::test(ManageRegulatoryProfiles::class)
            ->callAction(TestAction::make('verify')->table($version->fresh()), data: ['verification_evidence' => 'Checked partner agreement and register']);
        $this->assertSame(RegulatoryProfileVersion::VERIFIED, $version->fresh()->status);
    }

    public function test_policy_versions_are_drafted_approved_by_another_person_and_published(): void
    {
        $this->seed(PolicyDocumentSeeder::class);
        $document = PolicyDocument::query()->where('slug', 'privacy-policy')->sole();
        $author = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('compliance_admin');

        $this->actingAsVerified($author);
        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $document, 'pageClass' => ViewPolicyDocument::class])
            ->callAction(TestAction::make('newVersion')->table(), data: ['body_markdown' => "# Privacy Policy\n\nCounsel-reviewed text for publication.", 'change_summary' => 'Counsel review'])
            ->assertHasNoActionErrors();

        $version = PolicyDocumentVersion::query()->where('policy_document_id', $document->id)->where('version', 2)->sole();

        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $document, 'pageClass' => ViewPolicyDocument::class])
            ->callAction(TestAction::make('approve')->table($version));
        $this->assertSame(PolicyDocumentVersion::DRAFT, $version->fresh()->status);

        $this->actingAsVerified($approver);
        Livewire::test(VersionsRelationManager::class, ['ownerRecord' => $document, 'pageClass' => ViewPolicyDocument::class])
            ->callAction(TestAction::make('approve')->table($version))
            ->callAction(TestAction::make('publish')->table($version->fresh()));

        $this->assertSame(PolicyDocumentVersion::PUBLISHED, $version->fresh()->status);
        $this->getJson('/api/v1/public/policies/privacy-policy')->assertOk()->assertJsonPath('data.version', 2);
    }

    public function test_settings_change_clears_verification_and_needs_another_verifier(): void
    {
        $this->seed(SystemSettingsSeeder::class);
        $setting = SystemSetting::query()->where('key', 'contact.email')->sole();
        $editor = $this->makeStaff('admin');
        $verifier = $this->makeStaff('admin');

        $this->actingAsVerified($editor);
        Livewire::test(ManageSystemSettings::class)
            ->callAction(TestAction::make('change')->table($setting), data: ['value' => 'hello@example.test', 'reason' => 'New mailbox'])
            ->callAction(TestAction::make('verify')->table($setting->fresh()));
        $this->assertNull($setting->fresh()->verified_at);

        $this->actingAsVerified($verifier);
        Livewire::test(ManageSystemSettings::class)->callAction(TestAction::make('verify')->table($setting->fresh()));
        $this->assertNotNull($setting->fresh()->verified_at);
    }
}
