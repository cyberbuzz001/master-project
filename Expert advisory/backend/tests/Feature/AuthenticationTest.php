<?php

namespace Tests\Feature;

use App\Http\Middleware\RequireTwoFactor;
use App\Models\AuditLog;
use App\Models\LoginHistory;
use App\Models\User;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    public function test_client_without_two_factor_signs_in(): void
    {
        $client = $this->makeClient();

        $response = $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => self::PASSWORD]);

        $response->assertOk()
            ->assertJsonPath('data.two_factor_required', false)
            ->assertJsonPath('data.user.email', $client->email)
            ->assertJsonPath('data.user.areas', ['portal'])
            ->assertHeader('X-Request-Id');

        $this->assertAuthenticatedAs($client);
        $this->assertDatabaseHas('login_histories', ['user_id' => $client->id, 'outcome' => LoginHistory::SUCCESS]);
        $this->assertDatabaseHas('audit_logs', ['actor_user_id' => $client->id, 'action' => 'auth.login']);
    }

    public function test_wrong_password_and_unknown_email_return_identical_errors(): void
    {
        $client = $this->makeClient();

        $wrong = $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => 'Wrong#Password123']);
        $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.test', 'password' => 'Wrong#Password123']);

        $this->assertApiError($wrong, 401, 'INVALID_CREDENTIALS');
        $this->assertApiError($unknown, 401, 'INVALID_CREDENTIALS');
        $this->assertSame($wrong->json('message'), $unknown->json('message'));
        $this->assertGuest();
    }

    public function test_account_locks_after_repeated_failures_and_rejects_correct_password(): void
    {
        $client = $this->makeClient();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => 'Wrong#Password123'], ['X-Forwarded-For' => "10.0.0.{$i}"]);
        }

        $this->assertTrue($client->fresh()->isLocked());
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.account_locked', 'subject_id' => $client->id]);

        $this->app['cache']->flush(); // clear the rate limiter to isolate the lockout behaviour

        $response = $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => self::PASSWORD]);
        $this->assertApiError($response, 423, 'ACCOUNT_LOCKED');
        $this->assertGuest();
    }

    public function test_deactivated_user_cannot_sign_in(): void
    {
        $client = $this->makeClient(['status' => User::STATUS_DEACTIVATED]);

        $this->assertApiError(
            $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => self::PASSWORD]),
            403,
            'ACCOUNT_INACTIVE',
        );
    }

    public function test_login_is_rate_limited(): void
    {
        $client = $this->makeClient();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => 'x']);
        }

        $this->assertApiError($this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => 'x']), 429, 'RATE_LIMITED');
    }

    public function test_two_factor_user_must_pass_challenge(): void
    {
        $admin = $this->makeStaff('admin');
        $secret = $this->enableTwoFactor($admin);

        $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.two_factor_required', true)
            ->assertJsonMissingPath('data.user');

        $this->assertGuest('web');

        $this->assertApiError($this->postJson('/api/v1/auth/two-factor/challenge', ['code' => '000000']), 422, 'TWO_FACTOR_INVALID_CODE');
        $this->assertGuest('web');

        $code = app(Google2FA::class)->getCurrentOtp($secret);

        $this->postJson('/api/v1/auth/two-factor/challenge', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('data.user.two_factor.verified_this_session', true);

        $this->assertAuthenticatedAs($admin);
        $this->getJson('/api/v1/admin/dashboard')->assertOk();
    }

    public function test_challenge_without_pending_login_is_rejected(): void
    {
        $this->assertApiError($this->postJson('/api/v1/auth/two-factor/challenge', ['code' => '123456']), 401, 'TWO_FACTOR_SESSION_EXPIRED');
    }

    public function test_recovery_code_is_single_use(): void
    {
        $admin = $this->makeStaff('admin');
        $this->actingAs($admin);

        $this->postJson('/api/v1/me/two-factor')->assertOk()->assertJsonStructure(['data' => ['secret', 'otpauth_url', 'qr_svg']]);
        $secret = $admin->fresh()->two_factor_secret;

        $codes = $this->postJson('/api/v1/me/two-factor/confirm', ['code' => app(Google2FA::class)->getCurrentOtp($secret)])
            ->assertOk()
            ->json('data.recovery_codes');

        $this->assertCount(8, $codes);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.two_factor.enabled', 'subject_id' => $admin->id]);

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => self::PASSWORD])->assertJsonPath('data.two_factor_required', true);
        $this->postJson('/api/v1/auth/two-factor/challenge', ['code' => $codes[0]])->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => self::PASSWORD])->assertJsonPath('data.two_factor_required', true);
        $this->assertApiError($this->postJson('/api/v1/auth/two-factor/challenge', ['code' => $codes[0]]), 422, 'TWO_FACTOR_INVALID_CODE');
    }

    public function test_staff_role_requiring_two_factor_is_blocked_until_enrolled(): void
    {
        $advisor = $this->makeStaff('business_advisor');

        $this->actingAs($advisor);

        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.two_factor.enrollment_required', true);
        $this->assertApiError($this->getJson('/api/v1/employee/dashboard'), 403, 'TWO_FACTOR_ENROLLMENT_REQUIRED');

        $this->enableTwoFactor($advisor);
        $this->assertApiError($this->getJson('/api/v1/employee/dashboard'), 403, 'TWO_FACTOR_REQUIRED');

        $this->withSession([RequireTwoFactor::SESSION_KEY => now()->getTimestamp()])
            ->getJson('/api/v1/employee/dashboard')
            ->assertOk();
    }

    public function test_mandatory_two_factor_cannot_be_disabled(): void
    {
        $admin = $this->makeStaff('admin');
        $this->actingAsVerified($admin);

        $this->assertApiError($this->deleteJson('/api/v1/me/two-factor', ['password' => self::PASSWORD]), 403, 'TWO_FACTOR_MANDATORY');
    }

    public function test_logout_ends_session_and_audits(): void
    {
        $client = $this->makeClient();
        $this->postJson('/api/v1/auth/login', ['email' => $client->email, 'password' => self::PASSWORD])->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.logout', 'actor_user_id' => $client->id]);
        $this->assertApiError($this->getJson('/api/v1/me'), 401, 'UNAUTHENTICATED');
    }

    public function test_password_change_requires_current_password_and_is_audited(): void
    {
        $client = $this->makeClient();
        $this->actingAs($client);

        $this->assertApiError($this->putJson('/api/v1/me/password', [
            'current_password' => 'wrong', 'password' => 'New#Password2026x', 'password_confirmation' => 'New#Password2026x',
        ]), 422, 'VALIDATION_FAILED');

        $this->assertApiError($this->putJson('/api/v1/me/password', [
            'current_password' => self::PASSWORD, 'password' => 'weak', 'password_confirmation' => 'weak',
        ]), 422, 'VALIDATION_FAILED');

        $this->putJson('/api/v1/me/password', [
            'current_password' => self::PASSWORD, 'password' => 'New#Password2026x', 'password_confirmation' => 'New#Password2026x',
        ])->assertOk();

        $log = AuditLog::query()->where('action', 'auth.password_changed')->firstOrFail();
        $this->assertStringNotContainsString('New#Password2026x', json_encode($log->toArray()));
    }
}
