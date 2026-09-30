<?php

namespace App\Http\Responses;

use App\Domain\Platform\RequestContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class ApiResponse
{
    public static function success(mixed $data = null, array $meta = [], int $status = 200): JsonResponse
    {
        $body = ['success' => true, 'data' => $data];

        if ($meta !== []) {
            $body['meta'] = $meta;
        }

        return new JsonResponse($body, $status);
    }

    public static function paginated(LengthAwarePaginator $paginator, callable $transform, array $meta = []): JsonResponse
    {
        return self::success(
            array_map($transform, $paginator->items()),
            array_merge([
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ], $meta),
        );
    }

    /**
     * @param  array<string, list<string>>  $errors
     */
    public static function error(string $code, string $message, int $status, array $errors = []): JsonResponse
    {
        $body = [
            'success' => false,
            'error_code' => $code,
            'message' => $message,
        ];

        if ($errors !== []) {
            $body['errors'] = $errors;
        }

        $body['request_id'] = RequestContext::requestId();
        $body['timestamp'] = now()->toIso8601String();

        return new JsonResponse($body, $status);
    }
}
