<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Billing\Gateways\GatewayRegistry;
use App\Domain\Billing\WebhookProcessor;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Provider callbacks. Unauthenticated by design — the signature is the authentication. The response
 * is always 200 for anything we have stored, so providers stop retrying an event we have already
 * seen and judged; the outcome is in `webhook_events`.
 */
final class WebhookController extends Controller
{
    public function __invoke(Request $request, GatewayRegistry $registry, WebhookProcessor $processor, string $provider): JsonResponse
    {
        $gateway = $registry->enabled($provider);

        $result = $processor->handle(
            $gateway,
            $request->getContent(),
            array_change_key_case($request->headers->all()),
            $request->json()->all(),
        );

        return ApiResponse::success([
            'status' => $result['status'],
            'duplicate' => $result['duplicate'],
        ], status: $result['status'] === 'invalid_signature' ? 202 : 200);
    }
}
