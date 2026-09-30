<?php

namespace Tests;

use App\Domain\Identity\RbacSynchronizer;
use App\Http\Middleware\RequireTwoFactor;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use PragmaRX\Google2FA\Google2FA;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    public const PASSWORD = 'Correct#Horse9Battery';

    protected function setUp(): void
    {
        parent::setUp();

        app(RbacSynchronizer::class)->sync();

        // Sanctum only starts a session for requests that come from the first-party frontend.
        $this->withHeaders(['Origin' => 'http://localhost:3000', 'Accept' => 'application/json']);
    }

    protected function makeStaff(string $role, array $attributes = [], array $employee = []): User
    {
        $user = User::factory()->create(array_merge(['user_type' => User::TYPE_STAFF, 'password' => self::PASSWORD], $attributes));
        $user->assignRole($role);
        Employee::create(array_merge(['user_id' => $user->id, 'employee_code' => 'T-'.$user->id], $employee));

        return $user->fresh();
    }

    protected function makeClient(array $attributes = []): User
    {
        $user = User::factory()->create(array_merge(['user_type' => User::TYPE_CLIENT, 'password' => self::PASSWORD], $attributes));
        $user->assignRole('client');

        return $user;
    }

    /**
     * Enrolls TOTP for the user and returns the secret.
     */
    protected function enableTwoFactor(User $user): string
    {
        $secret = app(Google2FA::class)->generateSecretKey(32);
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()])->save();

        return $secret;
    }

    /**
     * Signs in as a staff member who has enrolled and passed 2FA in this session.
     */
    protected function actingAsVerified(User $user): static
    {
        if (! $user->hasTwoFactorEnabled()) {
            $this->enableTwoFactor($user);
        }

        // A new session per identity: AuthenticateSession rejects sessions bound to another user's password hash.
        $this->flushSession();
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user)->withSession([RequireTwoFactor::SESSION_KEY => now()->getTimestamp()]);
    }

    protected function assertApiError(\Illuminate\Testing\TestResponse $response, int $status, string $code): void
    {
        $response->assertStatus($status)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', $code)
            ->assertJsonStructure(['success', 'error_code', 'message', 'request_id', 'timestamp']);
    }
}
