<?php

namespace App\Http\Middleware;

use App\Domain\Platform\RequestContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->headers->get('X-Request-Id');
        $id = is_string($incoming) && Str::isUuid($incoming) ? strtolower($incoming) : (string) Str::uuid7();

        Context::addHidden('request_id', $id);
        Context::add('request_id', $id); // included in log records

        $response = $next($request);
        $response->headers->set('X-Request-Id', RequestContext::requestId());

        return $response;
    }
}
