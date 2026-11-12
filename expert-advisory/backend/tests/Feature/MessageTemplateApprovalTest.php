<?php

namespace Tests\Feature;

use App\Domain\Communications\TemplateApprovalService;
use App\Domain\Shared\ApiException;
use App\Models\MessageTemplate;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MessageTemplateApprovalTest extends TestCase
{
    private function draft(): MessageTemplate
    {
        return app(TemplateApprovalService::class)->saveDraft($this->makeStaff('super_admin'), [
            'key' => 'trial_intro', 'name' => 'Trial intro', 'body' => 'Hello {{name}}', 'variables' => ['name'], 'channel' => 'whatsapp',
            'language_code' => 'en', 'provider_template_name' => 'trial_intro',
        ]);
    }

    public function test_author_cannot_approve_their_own_template(): void
    {
        $draft = $this->draft();
        $this->expectException(ApiException::class);
        app(TemplateApprovalService::class)->approve($draft->author, $draft);
    }

    public function test_second_authorized_person_approves_and_audits_template(): void
    {
        $draft = $this->draft();
        $reviewer = $this->makeStaff('compliance_admin');

        app(TemplateApprovalService::class)->approve($reviewer, $draft);

        $this->assertSame('approved', $draft->fresh()->status);
        $this->assertSame($reviewer->id, $draft->fresh()->approved_by_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'message_template.approved', 'subject_id' => $draft->id]);
    }

    public function test_meta_body_mismatch_does_not_verify_template(): void
    {
        $draft = $this->draft();
        config(['services.whatsapp.access_token' => 'test-token', 'services.whatsapp.business_account_id' => '456', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
        Http::fake(['https://graph.facebook.com/v24.0/456/message_templates*' => Http::response(['data' => [['name' => 'trial_intro', 'language' => 'en', 'status' => 'APPROVED', 'components' => [['type' => 'BODY', 'text' => 'Different approved text {{1}}']]]]])]);

        $verified = app(TemplateApprovalService::class)->syncMeta($draft);

        $this->assertFalse($verified);
        $this->assertSame('MAPPING_MISMATCH', $draft->fresh()->provider_status);
        Http::assertSentCount(1);
    }

    public function test_matching_meta_approval_does_not_replace_internal_review(): void
    {
        $draft = $this->draft();
        config(['services.whatsapp.access_token' => 'test-token', 'services.whatsapp.business_account_id' => '456', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
        Http::fake(['https://graph.facebook.com/v24.0/456/message_templates*' => Http::response(['data' => [['name' => 'trial_intro', 'language' => 'en', 'status' => 'APPROVED', 'components' => [['type' => 'BODY', 'text' => 'Hello {{1}}']]]]])]);

        $verified = app(TemplateApprovalService::class)->syncMeta($draft);

        $this->assertTrue($verified);
        $this->assertSame('draft', $draft->fresh()->status);
        $this->assertSame('APPROVED', $draft->fresh()->provider_status);
        Http::assertSentCount(1);
    }

    public function test_an_edit_during_meta_verification_cannot_approve_the_changed_mapping(): void
    {
        $draft = $this->draft();
        config(['services.whatsapp.access_token' => 'test', 'services.whatsapp.business_account_id' => '456', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
        Http::fake(['https://graph.facebook.com/v24.0/456/message_templates*' => function () use ($draft) {
            $draft->fresh()->update(['body' => 'Changed text {{name}}']);

            return Http::response(['data' => [['name' => 'trial_intro', 'language' => 'en', 'status' => 'APPROVED', 'components' => [['type' => 'BODY', 'text' => 'Hello {{1}}']]]]]);
        }]);
        $this->assertFalse(app(TemplateApprovalService::class)->syncMeta($draft));
        $this->assertNull($draft->fresh()->provider_status);
        Http::assertSentCount(1);
    }
}
