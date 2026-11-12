<?php

namespace Tests\Feature;

use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Crm\AutomationWorkflowEngine;
use App\Domain\Research\ResearchDistributionService;
use App\Models\Client;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\MessageTemplate;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\ScheduledAction;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ResearchNotificationTest extends TestCase
{
    private function publication(): array
    {
        $this->travelTo(Carbon::parse('2026-11-16T05:00:00Z'));
        config(['services.whatsapp.automation_enabled' => true, 'services.whatsapp.access_token' => 'test', 'services.whatsapp.phone_number_id' => '123', 'services.whatsapp.graph_version' => 'v24.0']);
        Http::preventStrayRequests();
        $staff = $this->makeStaff('super_admin');
        $user = $this->makeClient();
        $lead = Lead::forceCreate(['full_name' => 'Education recipient', 'mobile' => '+919876543210', 'communication_state' => 'CONSENT_VERIFIED']);
        $client = Client::create(['user_id' => $user->id, 'lead_id' => $lead->id, 'client_code' => 'PDF-1', 'full_name' => 'Education recipient', 'mobile' => $lead->mobile]);
        $trial = FreeTrial::create(['lead_id' => $lead->id, 'client_id' => $client->id, 'trial_code' => 'DEMO-PDF', 'trial_type' => 'equity', 'status' => 'active', 'start_date' => today(), 'end_date' => today()->addDay(), 'approved_by' => $staff->id, 'approved_at' => now()]);
        foreach (['whatsapp', 'educational_content'] as $purpose) {
            app(ConsentRecorder::class)->record('client', $client->id, $purpose, true, 'test', 'Explicit client opt-in for education');
        }
        MessageTemplate::create(['key' => 'education_pdf_v1', 'name' => 'Education PDF', 'channel' => 'whatsapp', 'body' => 'Hello {{name}}, {{report_title}}: {{portal_link}}', 'variables' => ['name', 'report_title', 'portal_link'], 'status' => 'approved', 'author_id' => $staff->id, 'provider_template_name' => 'education_pdf_v1', 'provider_status' => 'APPROVED', 'provider_checked_at' => now(), 'language_code' => 'en', 'purpose' => 'educational_content', 'provider_header_format' => 'DOCUMENT', 'provider_media_id' => 'reviewed-pdf-id']);
        $report = ResearchReport::create(['report_code' => 'PDF-1', 'title' => 'Managing risk', 'category' => ResearchReport::CATEGORY_EDUCATIONAL, 'archive_status' => 'active']);
        $version = ResearchVersion::create(['research_report_id' => $report->id, 'version' => 1, 'author_employee_id' => $staff->employee->id, 'title' => $report->title, 'status' => ResearchVersion::STATUS_PUBLISHED, 'published_at' => now(), 'eligible_trial_types' => ['equity'], 'whatsapp_template_key' => 'education_pdf_v1']);
        app(ResearchDistributionService::class)->distribute($version);
        app(ResearchDistributionService::class)->distribute($version);

        return [$client, $trial];
    }

    public function test_education_publication_queues_once_and_sends_approved_document_header(): void
    {
        $this->publication();
        $this->assertSame(1, ScheduledAction::count());
        Http::fake(['https://graph.facebook.com/v24.0/123/messages' => Http::response(['messages' => [['id' => 'wamid.pdf']]])]);
        $this->assertSame(1, app(AutomationWorkflowEngine::class)->processPendingActions());
        Http::assertSent(fn ($request) => $request['template']['components'][0]['parameters'][0]['document']['id'] === 'reviewed-pdf-id');
        $this->assertDatabaseHas('message_logs', ['status' => 'accepted', 'provider_message_id' => 'wamid.pdf', 'recipient_type' => 'client']);
    }

    public function test_trial_cancellation_or_new_consent_revocation_blocks_queued_content(): void
    {
        [$client,$trial] = $this->publication();
        app(ConsentRecorder::class)->record('client', $client->id, 'educational_content', false, 'test', 'Client withdrew education consent');
        $this->assertSame(0, app(AutomationWorkflowEngine::class)->processPendingActions());
        $this->assertDatabaseHas('message_logs', ['status' => 'consent_refused']);
        Http::assertNothingSent();
        $trial->update(['status' => 'cancelled']);
        ScheduledAction::query()->update(['status' => 'pending']);
        $this->assertSame(0, app(AutomationWorkflowEngine::class)->processPendingActions());
        Http::assertNothingSent();
    }
}
