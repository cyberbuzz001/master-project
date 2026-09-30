<?php

namespace Tests\Feature;

use App\Domain\Communications\NotificationService;
use App\Models\Client;
use App\Models\ConsentRecord;
use App\Models\MessageLog;
use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class CommunicationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_cannot_send_message_with_unapproved_template(): void
    {
        $author = User::factory()->create();

        $template = MessageTemplate::create([
            'key' => 'unapproved_draft',
            'channel' => 'email',
            'name' => 'Draft Template',
            'subject' => 'Welcome {{name}}',
            'body' => 'Hello {{name}}',
            'status' => 'draft',
            'author_id' => $author->id,
        ]);

        $clientUser = User::factory()->create();
        $client = Client::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-1001',
            'full_name' => 'Rajesh Sharma',
        ]);

        $service = new NotificationService();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('UNAPPROVED_TEMPLATE');

        $service->send('unapproved_draft', 'client', $client->id);
    }

    public function test_message_dispatch_refused_without_consent(): void
    {
        $author = User::factory()->create();
        $approver = User::factory()->create();

        $template = MessageTemplate::create([
            'key' => 'invoice_alert',
            'channel' => 'email',
            'name' => 'Invoice Issued Alert',
            'subject' => 'Invoice #{{invoice_number}} Available',
            'body' => 'Dear {{name}}, your invoice is ready.',
            'status' => 'approved',
            'author_id' => $author->id,
            'approved_by_id' => $approver->id,
            'approved_at' => now(),
        ]);

        $clientUser = User::factory()->create();
        $client = Client::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-1002',
            'full_name' => 'Anita Desai',
            'email' => 'anita@example.test',
            'mobile' => '+919876543211',
        ]);

        // No consent record exists!
        $service = new NotificationService();
        $log = $service->send('invoice_alert', 'client', $client->id, ['invoice_number' => 'INV-2026-001']);

        $this->assertInstanceOf(MessageLog::class, $log);
        $this->assertEquals('consent_refused', $log->status);
        $this->assertFalse($log->consent_verified);
        $this->assertStringContainsString('Dispatch refused', $log->error_message);

        // Assert Mail was NOT sent
        Mail::assertNothingSent();
    }

    public function test_message_dispatch_succeeds_when_consent_is_verified(): void
    {
        $author = User::factory()->create();
        $approver = User::factory()->create();

        $template = MessageTemplate::create([
            'key' => 'welcome_onboarding',
            'channel' => 'email',
            'name' => 'Welcome to Onboarding',
            'subject' => 'Welcome {{name}} to Expert Stocks',
            'body' => 'Dear {{name}}, please complete your risk profile at {{portal_link}}.',
            'status' => 'approved',
            'author_id' => $author->id,
            'approved_by_id' => $approver->id,
            'approved_at' => now(),
        ]);

        $clientUser = User::factory()->create();
        $client = Client::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-1003',
            'full_name' => 'Vikram Patel',
            'email' => 'vikram@example.test',
            'mobile' => '+919876543212',
        ]);

        // Record verified email consent
        ConsentRecord::create([
            'subject_type' => 'client',
            'subject_id' => $client->id,
            'channel' => 'email',
            'purpose' => 'transactional_email',
            'consent_text' => 'I agree to receive communications',
            'consent_text_hash' => hash('sha256', 'I agree to receive communications'),
            'granted' => true,
            'ip' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'captured_at' => now(),
        ]);

        $service = new NotificationService();
        $log = $service->send('welcome_onboarding', 'client', $client->id, [
            'portal_link' => 'https://expertstocks.in/portal/onboarding',
        ]);

        $this->assertInstanceOf(MessageLog::class, $log);
        $this->assertEquals('sent', $log->status);
        $this->assertTrue($log->consent_verified);
        $this->assertStringContainsString('Welcome Vikram Patel to Expert Stocks', $log->rendered_subject);
        $this->assertStringContainsString('https://expertstocks.in/portal/onboarding', $log->rendered_body);
        $this->assertNotNull($log->sent_at);
        $this->assertNotEmpty($log->provider_message_id);
    }
}
