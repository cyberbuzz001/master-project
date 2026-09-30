<?php

namespace App\Domain\Shared;

use RuntimeException;

/**
 * Domain error that renders into the standard API error envelope.
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>  $errors
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 400,
        public readonly array $errors = [],
    ) {
        parent::__construct($message);
    }

    public static function forbidden(string $message = 'You are not allowed to perform this action.', string $code = 'FORBIDDEN'): self
    {
        return new self($code, $message, 403);
    }

    public static function invalidTransition(string $from, string $to): self
    {
        return new self('INVALID_STATE_TRANSITION', "Cannot move from {$from} to {$to}.", 400);
    }

    public static function unprocessable(string $code, string $message, array $errors = []): self
    {
        return new self($code, $message, 422, $errors);
    }
}
