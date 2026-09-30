<?php

use App\Domain\Shared\ApiException;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsureAccountActive;
use App\Http\Middleware\RequireTwoFactor;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Responses\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->statefulApi();
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '127.0.0.1'));

        $middleware->alias([
            'active' => EnsureAccountActive::class,
            '2fa' => RequireTwoFactor::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*', 'webhooks/*', 'sanctum/*') || $request->expectsJson(),
        );

        $exceptions->dontReport([ApiException::class]);

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*', 'webhooks/*', 'sanctum/*') && ! $request->expectsJson()) {
                return null;
            }

            return match (true) {
                $e instanceof ApiException => ApiResponse::error($e->errorCode, $e->getMessage(), $e->status, $e->errors),
                $e instanceof ValidationException => ApiResponse::error('VALIDATION_FAILED', 'The submitted data is invalid.', 422, $e->errors()),
                $e instanceof AuthenticationException => ApiResponse::error('UNAUTHENTICATED', 'Please sign in to continue.', 401),
                $e instanceof AuthorizationException,
                $e instanceof AccessDeniedHttpException,
                $e instanceof UnauthorizedException => ApiResponse::error('FORBIDDEN', 'You are not allowed to perform this action.', 403),
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => ApiResponse::error('NOT_FOUND', 'The requested resource was not found.', 404),
                $e instanceof MethodNotAllowedHttpException => ApiResponse::error('METHOD_NOT_ALLOWED', 'This method is not allowed for this endpoint.', 405),
                $e instanceof ThrottleRequestsException,
                $e instanceof TooManyRequestsHttpException => ApiResponse::error('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429)
                    ->withHeaders(array_intersect_key($e->getHeaders(), array_flip(['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']))),
                $e instanceof TokenMismatchException,
                $e instanceof HttpExceptionInterface && $e->getStatusCode() === 419 => ApiResponse::error('CSRF_TOKEN_MISMATCH', 'Your session has expired. Refresh the page and try again.', 419),
                $e instanceof HttpExceptionInterface && $e->getStatusCode() === 503 => ApiResponse::error('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', 503),
                $e instanceof HttpExceptionInterface => ApiResponse::error('HTTP_ERROR', 'The request could not be completed.', $e->getStatusCode()),
                default => ApiResponse::error('INTERNAL_ERROR', 'An unexpected error occurred. Quote the request ID when contacting support.', 500),
            };
        });
    })->create();
