<?php

namespace App\Http\Middleware;

use App\Domain\Shared\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ends sessions of users who were deactivated or locked after they logged in.
 */
final class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && (! $user->isActive() || $user->isLocked())) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
            }

            throw new ApiException('ACCOUNT_INACTIVE', 'This account is not active. Contact support.', 403);
        }

        return $next($request);
    }
}
