<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\TwoFactorService;
use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Middleware\RequireTwoFactor;
use App\Http\Presenters\UserPresenter;
use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

final class AccountController extends Controller
{
    public function __construct(
        private readonly TwoFactorService $twoFactor,
        private readonly AuditLogger $audit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success(UserPresenter::me($request->user(), $request));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::defaults()],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'The current password is incorrect.', [
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->forceFill(['password' => $data['password'], 'password_changed_at' => now()])->save();

        $revoked = $this->revokeOtherSessions($request);
        $user->tokens()->delete();

        $this->audit->record('auth.password_changed', $user, new: ['other_sessions_revoked' => $revoked]);

        return ApiResponse::success(['other_sessions_revoked' => $revoked]);
    }

    public function beginTwoFactor(Request $request): JsonResponse
    {
        return ApiResponse::success($this->twoFactor->beginEnrollment($request->user()));
    }

    public function confirmTwoFactor(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'size:6']]);

        $codes = $this->twoFactor->confirmEnrollment($request->user(), $data['code']);

        if ($request->hasSession()) {
            $request->session()->put(RequireTwoFactor::SESSION_KEY, now()->getTimestamp());
        }

        return ApiResponse::success(['recovery_codes' => $codes]);
    }

    public function disableTwoFactor(Request $request): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string']]);

        if (! Hash::check($data['password'], $request->user()->password)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'The password is incorrect.', ['password' => ['The password is incorrect.']]);
        }

        $this->twoFactor->disable($request->user());

        return ApiResponse::success(null);
    }

    public function sessions(Request $request): JsonResponse
    {
        if (config('session.driver') !== 'database') {
            return ApiResponse::success([], ['supported' => false]);
        }

        $currentId = $request->hasSession() ? $request->session()->getId() : null;

        $rows = DB::table(config('session.table', 'sessions'))
            ->where('user_id', $request->user()->id)
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn ($row) => [
                'id' => hash('sha256', $row->id), // raw session IDs are never exposed
                'ip_address' => $row->ip_address,
                'user_agent' => $row->user_agent,
                'last_active_at' => date(DATE_ATOM, (int) $row->last_activity),
                'is_current' => $row->id === $currentId,
            ]);

        return ApiResponse::success($rows, ['supported' => true]);
    }

    public function revokeSession(Request $request, string $sessionHash): JsonResponse
    {
        $currentId = $request->hasSession() ? $request->session()->getId() : null;

        $target = DB::table(config('session.table', 'sessions'))
            ->where('user_id', $request->user()->id)
            ->pluck('id')
            ->first(fn (string $id) => hash_equals(hash('sha256', $id), $sessionHash));

        if ($target === null) {
            throw new ApiException('NOT_FOUND', 'Session not found.', 404);
        }

        if ($target === $currentId) {
            throw new ApiException('CANNOT_REVOKE_CURRENT_SESSION', 'Use sign out to end the current session.', 409);
        }

        DB::table(config('session.table', 'sessions'))->where('id', $target)->delete();
        $this->audit->record('auth.session_revoked', $request->user());

        return ApiResponse::success(null);
    }

    public function loginHistory(Request $request): JsonResponse
    {
        $rows = $request->user()->loginHistories()
            ->latest('created_at')
            ->limit(50)
            ->get(['outcome', 'ip', 'user_agent', 'created_at'])
            ->map(fn ($row) => [
                'outcome' => $row->outcome,
                'ip' => $row->ip,
                'user_agent' => $row->user_agent,
                'created_at' => $row->created_at?->toIso8601String(),
            ]);

        return ApiResponse::success($rows);
    }

    private function revokeOtherSessions(Request $request): int
    {
        if (config('session.driver') !== 'database') {
            return 0;
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $request->user()->id)
            ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
            ->delete();
    }
}
