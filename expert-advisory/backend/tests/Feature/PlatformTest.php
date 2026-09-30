<?php

namespace Tests\Feature;

use App\Domain\Audit\AuditLogger;
use App\Models\AuditLog;
use App\Models\ConsentRecord;
use App\Models\Lead;
use App\Models\SystemSetting;
use Database\Seeders\DemoSeeder;
use Database\Seeders\SystemSettingsSeeder;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class PlatformTest extends TestCase
{
    public function test_request_id_is_echoed_when_valid_and_generated_otherwise(): void
    {
        $id = '0192b0c6-6c1e-7f3a-9a51-1c2d3e4f5a6b';

        $this->getJson('/api/v1/health', ['X-Request-Id' => $id])->assertOk()->assertHeader('X-Request-Id', $id);

        $generated = $this->getJson('/api/v1/health', ['X-Request-Id' => "bad\nvalue"])->headers->get('X-Request-Id');
        $this->assertNotSame("bad\nvalue", $generated);
        $this->assertTrue(\Illuminate\Support\Str::isUuid($generated));
    }

    public function test_error_envelope_for_not_found_and_request_id_matches_header(): void
    {
        $response = $this->getJson('/api/v1/does-not-exist');

        $this->assertApiError($response, 404, 'NOT_FOUND');
        $this->assertSame($response->headers->get('X-Request-Id'), $response->json('request_id'));
    }

    public function test_unexpected_errors_do_not_leak_internals(): void
    {
        config(['app.debug' => true]);
        \Illuminate\Support\Facades\Route::get('/api/v1/_boom', fn () => throw new RuntimeException('SQLSTATE secret connection string'));

        $response = $this->getJson('/api/v1/_boom');

        $this->assertApiError($response, 500, 'INTERNAL_ERROR');
        $response->assertDontSee('SQLSTATE')->assertJsonMissingPath('trace')->assertJsonMissingPath('exception');
    }

    public function test_security_headers_are_present(): void
    {
        $this->getJson('/api/v1/health')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }

    public function test_audit_log_is_append_only_and_masks_secrets(): void
    {
        $log = app(AuditLogger::class)->record('test.event', null, ['password' => 'old-secret'], ['password' => 'new-secret', 'nested' => ['token' => 'abc'], 'name' => 'Visible']);

        $this->assertSame('[REDACTED]', $log->new_values['password']);
        $this->assertSame('[REDACTED]', $log->new_values['nested']['token']);
        $this->assertSame('Visible', $log->new_values['name']);

        try {
            $log->update(['action' => 'tampered']);
            $this->fail('Audit log update should throw.');
        } catch (LogicException) {
        }

        $this->expectException(LogicException::class);
        AuditLog::query()->firstOrFail()->delete();
    }

    public function test_consent_records_are_append_only(): void
    {
        $record = ConsentRecord::create([
            'subject_type' => 'lead', 'subject_id' => 1, 'purpose' => 'calls', 'granted' => true, 'channel' => 'web_form',
            'consent_text' => 'x', 'consent_text_hash' => hash('sha256', 'x'), 'captured_at' => now(),
        ]);

        $this->expectException(LogicException::class);
        $record->update(['granted' => false]);
    }

    public function test_unverified_contact_settings_are_hidden_from_public_site(): void
    {
        $this->seed(SystemSettingsSeeder::class);

        $this->getJson('/api/v1/public/site')
            ->assertOk()
            ->assertJsonPath('data.settings.company.brand_name', 'Expert Stocks Consultancy')
            ->assertJsonMissingPath('data.settings.contact.email')
            ->assertJsonPath('data.regulatory_profile_verified', false);
    }

    public function test_settings_verification_requires_a_second_person(): void
    {
        $this->seed(SystemSettingsSeeder::class);
        $editor = $this->makeStaff('admin');
        $verifier = $this->makeStaff('admin');

        $this->actingAsVerified($editor)->putJson('/api/v1/admin/settings', ['values' => ['contact.email' => 'hello@example.test'], 'reason' => 'Updated mailbox'])->assertOk();
        $this->assertApiError($this->postJson('/api/v1/admin/settings/verify', ['key' => 'contact.email']), 403, 'SEPARATION_OF_DUTIES');

        $this->actingAsVerified($verifier)->postJson('/api/v1/admin/settings/verify', ['key' => 'contact.email'])->assertOk();

        $this->getJson('/api/v1/public/site')->assertJsonPath('data.settings.contact.email', 'hello@example.test');
        $this->assertNotNull(SystemSetting::query()->where('key', 'contact.email')->value('verified_at'));
    }

    public function test_demo_seeder_refuses_production(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(RuntimeException::class);
        (new DemoSeeder)->run();
    }

    public function test_demo_records_are_hidden_when_demo_mode_is_off_and_excluded_from_dashboard(): void
    {
        config(['platform.demo_mode' => false]);
        Lead::create(['full_name' => 'Real lead']);
        Lead::create(['full_name' => '[DEMO] lead', 'is_demo' => true]);

        $this->assertSame(1, Lead::query()->count());

        config(['platform.demo_mode' => true]);
        $this->assertSame(2, Lead::query()->count());

        $this->actingAsVerified($this->makeStaff('admin'))
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.leads.total', 1)
            ->assertJsonPath('data.compliance.publication_ready', false)
            ->assertJsonPath('data.modules.0.enabled', false);
    }
}
