<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\LoginService;
use App\Domain\Identity\TwoFactorService;
use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Middleware\RequireTwoFactor;
use App\Http\Presenters\UserPresenter;
use App\Http\Responses\ApiResponse;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class AuthController extends Controller
{
    private const PENDING_KEY = 'auth.pending_two_factor';

    private const PENDING_TTL_SECONDS = 300;

    public function __construct(
        private readonly LoginService $login,
        private readonly TwoFactorService $twoFactor,
        private readonly AuditLogger $audit,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        self::ensureSession($request);

        $user = $this->login->attempt($data['email'], $data['password']);

        if ($user->hasTwoFactorEnabled()) {
            $request->session()->put(self::PENDING_KEY, [
                'user_id' => $user->id,
                'remember' => (bool) ($data['remember'] ?? false),
                'expires_at' => now()->addSeconds(self::PENDING_TTL_SECONDS)->getTimestamp(),
            ]);
            $this->login->logTwoFactorPending($user);

            return ApiResponse::success(['two_factor_required' => true]);
        }

        Auth::guard('web')->login($user, (bool) ($data['remember'] ?? false));
        $request->session()->regenerate();
        $this->login->completeLogin($user);

        return ApiResponse::success(['two_factor_required' => false, 'user' => UserPresenter::me($user, $request)]);
    }

    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32']]);

        self::ensureSession($request);

        $pending = $request->session()->get(self::PENDING_KEY);

        if (! is_array($pending) || $pending['expires_at'] < now()->getTimestamp()) {
            $request->session()->forget(self::PENDING_KEY);

            throw new ApiException('TWO_FACTOR_SESSION_EXPIRED', 'Your sign-in attempt expired. Please sign in again.', 401);
        }

        $user = User::query()->findOrFail($pending['user_id']);

        if ($user->isLocked() || ! $user->isActive()) {
            $request->session()->forget(self::PENDING_KEY);

            throw new ApiException('ACCOUNT_LOCKED', 'This account is temporarily locked. Try again later or contact support.', 423);
        }

        if (! $this->twoFactor->verifyChallenge($user, $data['code'])) {
            $this->login->registerTwoFactorFailure($user);

            throw ApiException::unprocessable('TWO_FACTOR_INVALID_CODE', 'The authentication code is invalid.', [
                'code' => ['The authentication code is invalid.'],
            ]);
        }

        $request->session()->forget(self::PENDING_KEY);
        Auth::guard('web')->login($user, (bool) $pending['remember']);
        $request->session()->regenerate();
        $request->session()->put(RequireTwoFactor::SESSION_KEY, now()->getTimestamp());
        $this->login->completeLogin($user);

        return ApiResponse::success(['user' => UserPresenter::me($user, $request)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user !== null) {
            $this->audit->record('auth.logout', $user);
        }

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return ApiResponse::success(null);
    }

    private static function ensureSession(Request $request): void
    {
        if (! $request->hasSession()) {
            throw new ApiException('SESSION_REQUIRED', 'Sign-in must be performed from the web application.', 400);
        }
    }
}
