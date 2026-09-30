<?php

namespace App\Http\Middleware;

use Filament\Http\Middleware\Authenticate;

/**
 * The back-office has no login screen of its own: staff sign in through the shared
 * sign-in page (lockout, login history, TOTP 2FA) and return here with the same session.
 */
class OfficeAuthenticate extends Authenticate
{
    protected function redirectTo($request): ?string
    {
        return config('platform.frontend_url').'/login?next='.rawurlencode('/'.ltrim($request->path(), '/'));
    }
}
