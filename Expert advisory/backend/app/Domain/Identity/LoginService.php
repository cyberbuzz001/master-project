<?php

namespace App\Domain\Identity;

use App\Domain\Audit\AuditLogger;
use App\Domain\Platform\RequestContext;
use App\Domain\Shared\ApiException;
use App\Models\LoginHistory;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Credential verification with progressive lockout. Session handling stays in the controller.
 */
final class LoginService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function attempt(string $email, string $password): User
    {
        $user = User::query()->where('email', mb_strtolower(trim($email)))->first();

        if ($user === null) {
            Hash::check($password, self::dummyHash());
            $this->log(null, $email, LoginHistory::FAILED);

            throw self::invalidCredentials();
        }

        if ($user->isLocked()) {
            $this->log($user, $email, LoginHistory::LOCKED);

            throw new ApiException('ACCOUNT_LOCKED', 'This account is temporarily locked. Try again later or contact support.', 423);
        }

        if (! Hash::check($password, $user->password)) {
            $this->registerFailure($user, $email);

            throw self::invalidCredentials();
        }

        if (! $user->isActive()) {
            $this->log($user, $email, LoginHistory::INACTIVE);

            throw new ApiException('ACCOUNT_INACTIVE', 'This account is not active. Contact support.', 403);
        }

        return $user;
    }

    public function completeLogin(User $user): void
    {
        $user->forceFill([
            'failed_login_count' => 0,
            'lockout_count' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
            'last_login_ip' => RequestContext::ip(),
        ])->save();

        $this->log($user, $user->email, LoginHistory::SUCCESS);
        $this->audit->record('auth.login', $user, actor: $user);
    }

    public function logTwoFactorPending(User $user): void
    {
        $this->log($user, $user->email, LoginHistory::TWO_FACTOR_REQUIRED);
    }

    public function registerTwoFactorFailure(User $user): void
    {
        $this->registerFailure($user, $user->email, LoginHistory::TWO_FACTOR_FAILED);
    }

    private function registerFailure(User $user, string $email, string $outcome = LoginHistory::FAILED): void
    {
        $failures = $user->failed_login_count + 1;
        $attributes = ['failed_login_count' => $failures];

        if ($failures >= (int) config('platform.security.max_failed_logins')) {
            $lockouts = $user->lockout_count + 1;
            $minutes = min(
                (int) config('platform.security.lockout_base_minutes') * (2 ** ($lockouts - 1)),
                (int) config('platform.security.lockout_max_minutes'),
            );

            $attributes += ['failed_login_count' => 0, 'lockout_count' => $lockouts, 'locked_until' => now()->addMinutes($minutes)];
            $this->audit->record('auth.account_locked', $user, new: ['minutes' => $minutes, 'lockout_count' => $lockouts], actor: $user, actorType: 'system');
        }

        $user->forceFill($attributes)->save();
        $this->log($user, $email, $outcome);
    }

    private function log(?User $user, string $email, string $outcome): void
    {
        LoginHistory::create([
            'user_id' => $user?->id,
            'email_attempted' => mb_substr($email, 0, 255),
            'outcome' => $outcome,
            'ip' => RequestContext::ip(),
            'user_agent' => RequestContext::userAgent(),
            'device_hash' => RequestContext::deviceHash(),
            'request_id' => RequestContext::requestId(),
        ]);
    }

    /**
     * A real hash for the configured driver, so unknown emails cost the same time as wrong passwords.
     */
    private static function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= Hash::make(bin2hex(random_bytes(16)));
    }

    private static function invalidCredentials(): ApiException
    {
        return new ApiException('INVALID_CREDENTIALS', 'The email or password is incorrect.', 401);
    }
}
