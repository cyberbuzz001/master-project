<?php

namespace Tests\Feature;

use App\Domain\Onboarding\AgreementService;
use App\Domain\Onboarding\ClientConversionService;
use App\Domain\Onboarding\DocumentRetentionService;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Onboarding\KycService;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Onboarding\RiskProfileService;
use App\Domain\Shared\ApiException;
use App\Models\Agreement;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\KycCheck;
use App\Models\Lead;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use App\Models\RiskReport;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\OnboardingSeeder;
use Database\Seeders\SystemSettingsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Tests\TestCase;

class OnboardingTest extends TestCase
{
    private RiskQuestionnaireVersion $questionnaire;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(OnboardingSeeder::class);

        $this->questionnaire = RiskQuestionnaire::query()->where('code', 'suitability')->sole()->versions()->sole();
        $this->questionnaire->forceFill(['status' => RiskQuestionnaireVersion::PUBLISHED, 'published_at' => now()])->save();
    }

    private function client(array $attributes = []): Client
    {
        return Client::create(array_merge([
            'client_code' => 'ESC-2026-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT),
            'full_name' => 'Asha Menon',
            'email' => 'asha@example.test',
            'mobile' => '+919800000101',
        ], $attributes));
    }

    /** @return array<string, string|list<string>> */
    private function answers(array $overrides = []): array
    {
        return array_merge([
            'experience' => '3_7y',
            'horizon' => '3_5y',
            'loss_tolerance' => 'hold',
            'income_stability' => 'stable',
            'capital_share' => 'small',
            'instruments' => ['equity', 'mf'],
        ], $overrides);
    }

    public function test_scoring_is_deterministic_and_reproducible(): void
    {
        $service = app(RiskProfileService::class);

        $first = $service->score($this->questionnaire, $this->answers());
        $second = $service->score($this->questionnaire, $this->answers());

        // 4*2 + 4*2 + 4*2 + 3 + 5 + 2 = 34
        $this->assertSame(34, $first['raw_score']);
        $this->assertSame('balanced', $first['band']['key']);
        $this->assertSame($first['answers_sha256'], $second['answers_sha256']);

        $cautious = $service->score($this->questionnaire, $this->answers([
            'experience' => 'lt_1y', 'horizon' => 'lt_1y', 'loss_tolerance' => 'exit', 'income_stability' => 'unstable',
            'capital_share' => 'most', 'instruments' => ['mf'],
        ]));

        $this->assertSame(1, $cautious['raw_score']);
        $this->assertSame('conservative', $cautious['band']['key']);
        $this->assertContains('low_loss_tolerance', $cautious['suitability_flags']);
        $this->assertNotSame($first['answers_sha256'], $cautious['answers_sha256']);
    }

    public function test_incomplete_or_unknown_answers_are_refused(): void
    {
        $service = app(RiskProfileService::class);
        $client = $this->client();

        $this->expectException(ApiException::class);
        $service->submit($client, $this->questionnaire, $this->answers(['horizon' => null]));
    }

    public function test_assessment_is_immutable_and_supersedes_the_previous_one(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $client = $this->client();
        $service = app(RiskProfileService::class);

        $first = $service->submit($client, $this->questionnaire, $this->answers(), $advisor);
        $second = $service->submit($client, $this->questionnaire, $this->answers(['loss_tolerance' => 'add']), $advisor);

        $this->assertSame(RiskProfile::SUPERSEDED, $first->fresh()->status);
        $this->assertSame(RiskProfile::SUBMITTED, $second->status);
        $this->assertSame(6, $second->answers()->count());
        $this->assertNotNull($second->expires_at);

        $this->expectException(LogicException::class);
        $second->forceFill(['raw_score' => 99])->save();
    }

    public function test_finalisation_requires_client_acknowledgement_and_overrides_need_a_reason(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $client = $this->client();
        $service = app(RiskProfileService::class);

        $profile = $service->submit($client, $this->questionnaire, $this->answers(), $advisor);

        try {
            $service->finalize($advisor, $profile);
            $this->fail('Finalisation should require acknowledgement.');
        } catch (ApiException $e) {
            $this->assertSame('NOT_ACKNOWLEDGED', $e->errorCode);
        }

        $service->acknowledge($profile);
        $service->finalize($advisor, $profile);

        $this->assertSame(RiskProfile::FINALIZED, $profile->fresh()->status);
        $this->assertSame($profile->id, $client->fresh()->risk_profile_id);

        // An advisor cannot move the category; compliance can, with a reason, and the score survives.
        $this->assertFalse($advisor->can('risk_profile.override'));

        try {
            $service->override($advisor, $profile->fresh(), 'moderate', 'Client asked for it');
            $this->fail('Override should be refused.');
        } catch (ApiException $e) {
            $this->assertSame(403, $e->status);
        }

        $override = $service->override($compliance, $profile->fresh(), 'moderate', 'Client is close to retirement; capacity for loss is lower than the score suggests.');

        $this->assertSame('balanced', $override->from_category);
        $this->assertSame('moderate', $profile->fresh()->risk_category);
        $this->assertSame(34, $profile->fresh()->raw_score);
    }

    public function test_sign_off_issues_a_verifiable_report_pdf(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $client = $this->client();
        $risk = app(RiskProfileService::class);

        $profile = $risk->submit($client, $this->questionnaire, $this->answers(), $advisor);
        $risk->acknowledge($profile);
        $risk->finalize($advisor, $profile);

        $report = RiskReport::query()->where('risk_profile_id', $profile->id)->sole();
        $document = $report->document;
        $version = $document->currentVersion();
        $pdf = app(DocumentVault::class)->contents($version);

        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertSame($report->pdf_sha256, hash('sha256', $pdf), 'The recorded hash must match the stored file.');
        $this->assertSame('risk_profile_report', $document->category);
        $this->assertStringStartsWith('RP-'.now()->format('Y'), $report->report_number);

        // Public verification confirms the report without exposing client details.
        $body = $this->getJson('/api/v1/public/verify/'.$report->verification_token)->assertOk()->json('data');

        $this->assertTrue($body['found']);
        $this->assertSame('risk_report', $body['type']);
        $this->assertSame('Balanced', $body['details']['Risk category recorded']);
        $this->assertFalse($body['superseded']);
        $this->assertArrayNotHasKey('client', $body);
        $this->assertStringNotContainsString($client->full_name, json_encode($body));

        // Retaking supersedes it, and verification says so.
        $risk->submit($client, $this->questionnaire, $this->answers(['loss_tolerance' => 'add']), $advisor);
        $this->assertTrue($this->getJson('/api/v1/public/verify/'.$report->verification_token)->json('data.superseded'));

        $this->getJson('/api/v1/public/verify/'.str_repeat('0', 40))->assertOk()->assertJsonPath('data.found', false);
    }

    public function test_documents_are_encrypted_versioned_and_every_access_is_logged(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $client = $this->client();
        $vault = app(DocumentVault::class);

        $document = $vault->store($advisor, 'client', $client->id, 'pan', UploadedFile::fake()->create('pan.pdf', 12, 'application/pdf'));
        $version = $document->currentVersion();

        $stored = Storage::disk('local')->get($version->path);
        $this->assertNotSame('', $stored);
        $this->assertStringNotContainsString('%PDF', $stored, 'The file should not be readable on disk.');
        $this->assertSame(hash('sha256', Crypt::decryptString($stored)), $version->sha256);
        $this->assertSame(Document::PENDING, $document->status);

        // Replacing the file adds a version and re-opens verification.
        $vault->verify($compliance, $document);
        $this->assertSame(Document::VERIFIED, $document->fresh()->status);

        $vault->store($advisor, 'client', $client->id, 'pan', UploadedFile::fake()->create('pan-v2.pdf', 12, 'application/pdf'));
        $document->refresh();
        $this->assertSame(2, $document->versions()->count());
        $this->assertSame(Document::PENDING, $document->status);

        // An advisor without kyc.verify cannot verify.
        try {
            $vault->verify($advisor, $document);
            $this->fail('Verification should be refused.');
        } catch (ApiException $e) {
            $this->assertSame(403, $e->status);
        }

        $this->assertSame(
            ['uploaded', 'verified', 'uploaded'],
            DocumentAccessLog::query()->where('document_id', $document->id)->orderBy('id')->pluck('action')->all(),
        );
    }

    public function test_retention_marks_expired_documents_and_only_purges_when_switched_on(): void
    {
        $this->seed(SystemSettingsSeeder::class);
        $advisor = $this->makeStaff('business_advisor');
        $client = $this->client();
        $vault = app(DocumentVault::class);

        $expiring = $vault->store($advisor, 'client', $client->id, 'address_proof', UploadedFile::fake()->create('bill.pdf', 8, 'application/pdf'));
        $expiring->forceFill(['document_expires_on' => now()->subDay()])->save();

        $old = $vault->store($advisor, 'client', $client->id, 'pan', UploadedFile::fake()->create('pan.pdf', 8, 'application/pdf'));
        $old->forceFill(['retain_until' => now()->subDay()])->save();
        $path = $old->currentVersion()->path;

        $result = app(DocumentRetentionService::class)->sweep();

        $this->assertSame(1, $result['expired']);
        $this->assertSame(0, $result['purged'], 'Purging must stay off unless it is deliberately enabled.');
        $this->assertSame(1, $result['due']);
        $this->assertSame(Document::EXPIRED, $expiring->fresh()->status);
        Storage::disk('local')->assertExists($path);

        SystemSetting::query()->where('key', 'documents.auto_purge')->update(['value' => '1']);
        $this->assertSame(1, app(DocumentRetentionService::class)->sweep()['purged']);

        Storage::disk('local')->assertMissing($path);
        $this->assertSoftDeleted('documents', ['id' => $old->id]);
        // The trail survives the file.
        $this->assertTrue(DocumentAccessLog::query()->where(['document_id' => $old->id, 'action' => 'purged'])->exists());
        $this->assertDatabaseHas('document_versions', ['document_id' => $old->id, 'sha256' => $old->currentVersion()->sha256]);
    }

    public function test_signed_download_link_is_required_and_logged(): void
    {
        $advisor = $this->makeStaff('business_advisor', employee: []);
        $manager = $this->makeStaff('sales_manager');
        $client = $this->client();
        $vault = app(DocumentVault::class);
        $document = $vault->store($advisor, 'client', $client->id, 'address_proof', UploadedFile::fake()->create('bill.pdf', 8, 'application/pdf'));

        $this->actingAsVerified($manager);
        $url = $vault->temporaryUrl($manager, $document);

        $this->get('/documents/'.$document->uuid.'/download')->assertForbidden();
        $this->get($url)->assertOk()->assertDownload('bill.pdf');

        $actions = DocumentAccessLog::query()->where('document_id', $document->id)->pluck('action');
        $this->assertTrue($actions->contains('link_issued'));
        $this->assertTrue($actions->contains('downloaded'));
    }

    public function test_kyc_identifiers_are_masked_and_verification_drives_client_status(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $client = $this->client();
        $kyc = app(KycService::class);

        try {
            $kyc->record($advisor, $client, 'pan', 'NOTAPAN1');
            $this->fail('An invalid PAN should be refused.');
        } catch (ApiException $e) {
            $this->assertSame('INVALID_IDENTIFIER', $e->errorCode);
        }

        $check = $kyc->record($advisor, $client, 'pan', 'ABCDE1234F');

        $this->assertSame('XXXXXX234F', $check->identifier_masked);
        $this->assertNotSame('ABCDE1234F', $check->identifier_hash);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'kyc.recorded', 'new_values->identifier' => 'ABCDE1234F']);
        $this->assertSame('in_review', $client->fresh()->kyc_status);

        $kyc->verify($compliance, $check);
        $kyc->verify($compliance, $kyc->record($advisor, $client, 'address'));

        $this->assertSame('verified', $client->fresh()->kyc_status);

        $kyc->reject($compliance, $check->fresh(), 'The scan is unreadable.');
        $this->assertSame('rejected', $client->fresh()->kyc_status);
        $this->assertSame(KycCheck::REJECTED, $check->fresh()->status);
    }

    public function test_agreements_need_a_second_approver_and_acceptance_is_evidence(): void
    {
        $contentManager = $this->makeStaff('content_manager');
        $compliance = $this->makeStaff('compliance_admin');
        $client = $this->client();
        $service = app(AgreementService::class);
        $agreement = Agreement::query()->where('code', 'client_agreement')->sole();

        $version = $service->draft($compliance, $agreement, '## Scope of services'.PHP_EOL.'The firm provides research services.');
        $service->submitForApproval($compliance, $version);

        try {
            $service->approve($compliance, $version);
            $this->fail('The author must not approve their own agreement.');
        } catch (ApiException $e) {
            $this->assertSame('SEPARATION_OF_DUTIES', $e->errorCode);
        }

        $this->assertFalse($contentManager->can('policies.approve'));

        $approver = $this->makeStaff('super_admin');
        $service->approve($approver, $version);
        $service->publish($approver, $version);

        $this->assertSame(AgreementVersion::PUBLISHED, $version->fresh()->status);

        // Published text can never be edited afterwards.
        try {
            $version->fresh()->update(['body_markdown' => 'Changed after the fact']);
            $this->fail('Published agreement text must be immutable.');
        } catch (LogicException) {
        }

        $acceptance = $service->accept($client, $version->fresh(), 'portal');

        $this->assertNotEmpty($acceptance->evidence_sha256);
        $this->assertDatabaseHas('consent_records', ['subject_type' => 'client', 'subject_id' => $client->id, 'purpose' => 'client_agreement']);
        $this->assertSame($acceptance->id, $service->accept($client, $version->fresh(), 'portal')->id, 'Accepting twice must not duplicate evidence.');
        $this->assertSame([], $service->outstandingFor($client->fresh()));
    }

    public function test_client_is_only_activated_once_every_required_step_is_complete(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $compliance = $this->makeStaff('compliance_admin');
        $approver = $this->makeStaff('super_admin');

        $lead = Lead::forceCreate(['full_name' => 'Rahul Nair', 'mobile' => '+919800000202', 'email' => 'rahul@example.test', 'assigned_employee_id' => $advisor->employee->id]);
        $client = app(ClientConversionService::class)->convert($advisor, $lead);

        $this->assertSame('CONVERTED', $lead->fresh()->status);
        $this->assertSame(OnboardingService::ONBOARDING, $client->onboarding_status);
        $this->assertSame(count(config('onboarding.steps')), $client->onboardingSteps()->count());

        $onboarding = app(OnboardingService::class);

        try {
            $onboarding->activate($advisor, $client);
            $this->fail('Activation should be blocked while steps are outstanding.');
        } catch (ApiException $e) {
            $this->assertSame('ONBOARDING_INCOMPLETE', $e->errorCode);
            $this->assertNotEmpty($e->errors['steps']);
        }

        // Agreement
        $agreementService = app(AgreementService::class);
        $version = $agreementService->draft($compliance, Agreement::query()->where('code', 'client_agreement')->sole(), 'Terms');
        $agreementService->submitForApproval($compliance, $version);
        $agreementService->approve($approver, $version);
        $agreementService->publish($approver, $version);
        $agreementService->accept($client, $version->fresh(), 'portal');

        // KYC
        $kyc = app(KycService::class);
        $kyc->verify($compliance, $kyc->record($advisor, $client, 'pan', 'ABCDE1234F'));
        $kyc->verify($compliance, $kyc->record($advisor, $client, 'address'));

        // Risk profile
        $risk = app(RiskProfileService::class);
        $profile = $risk->submit($client, $this->questionnaire, $this->answers(), $advisor);
        $risk->acknowledge($profile);
        $risk->finalize($advisor, $profile);

        $onboarding->completeStep($compliance, $client, 'suitability', 'Reviewed against the balanced band.');

        $this->assertSame([], $onboarding->outstanding($client->fresh()));

        $onboarding->activate($advisor, $client->fresh());
        $client->refresh();

        $this->assertSame(OnboardingService::ACTIVE, $client->onboarding_status);
        $this->assertNotNull($client->onboarded_at);

        // Optional steps can be skipped with a reason; required ones cannot.
        $onboarding->skipStep($advisor, $client, 'welcome', 'Client asked not to receive the pack.');

        $this->expectException(ApiException::class);
        $onboarding->skipStep($advisor, $client, 'kyc', 'Not needed');
    }

    public function test_clients_are_scoped_like_leads(): void
    {
        $advisor = $this->makeStaff('business_advisor');
        $other = $this->makeStaff('business_advisor');
        $manager = $this->makeStaff('sales_manager');

        $mine = $this->client(['relationship_manager_employee_id' => $advisor->employee->id]);
        $theirs = $this->client(['client_code' => 'ESC-2026-90001', 'relationship_manager_employee_id' => $other->employee->id]);

        $visible = fn (User $user) => Client::query()->visibleTo($user)->pluck('id')->all();

        $this->assertSame([$mine->id], $visible($advisor));
        $this->assertEqualsCanonicalizing([$mine->id, $theirs->id], $visible($manager));
    }
}
