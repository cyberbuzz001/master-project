<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Web counterpart of EnsureAccountActive + RequireTwoFactor for the Filament back-office.
 */
class EnsureOfficeSessionIsSecure
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return $next($request);
        }

        $frontend = config('platform.frontend_url');

        if (! $user->isActive() || $user->isLocked()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->away($frontend.'/login');
        }

        if ($user->requiresTwoFactor()) {
            if (! $user->hasTwoFactorEnabled()) {
                return redirect()->away($frontend.'/account/security?setup=2fa');
            }

            if ($request->session()->get(RequireTwoFactor::SESSION_KEY) === null) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->away($frontend.'/login?next='.rawurlencode('/'.ltrim($request->path(), '/')));
            }
        }

        return $next($request);
    }
}
