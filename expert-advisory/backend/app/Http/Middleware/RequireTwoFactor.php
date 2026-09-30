<?php

namespace App\Http\Middleware;

use App\Domain\Shared\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks protected areas for users whose role mandates 2FA until they have enrolled
 * and passed a 2FA challenge in the current session.
 */
final class RequireTwoFactor
{
    public const SESSION_KEY = 'auth.two_factor_passed_at';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->requiresTwoFactor()) {
            return $next($request);
        }

        if (! $user->hasTwoFactorEnabled()) {
            throw ApiException::forbidden('Set up two-factor authentication to continue.', 'TWO_FACTOR_ENROLLMENT_REQUIRED');
        }

        if (! $request->hasSession() || $request->session()->get(self::SESSION_KEY) === null) {
            throw ApiException::forbidden('Two-factor verification is required.', 'TWO_FACTOR_REQUIRED');
        }

        return $next($request);
    }
}
