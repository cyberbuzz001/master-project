<?php

namespace App\Domain\Platform;

use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;

/**
 * Per-request metadata stamped onto audit, login and consent records.
 */
final class RequestContext
{
    public static function requestId(): string
    {
        $id = Context::getHidden('request_id');

        if (! is_string($id)) {
            $id = (string) Str::uuid7();
            Context::addHidden('request_id', $id);
        }

        return $id;
    }

    public static function ip(): ?string
    {
        return app()->runningInConsole() && ! app()->runningUnitTests() ? null : request()->ip();
    }

    public static function userAgent(): ?string
    {
        $agent = request()->userAgent();

        return $agent === null ? null : mb_substr($agent, 0, 512);
    }

    /**
     * Coarse device identifier (not a tracking fingerprint): hash of UA + accept-language.
     */
    public static function deviceHash(): ?string
    {
        $agent = request()->userAgent();

        if ($agent === null) {
            return null;
        }

        return hash_hmac('sha256', $agent.'|'.request()->header('Accept-Language', ''), (string) config('app.key'));
    }
}
