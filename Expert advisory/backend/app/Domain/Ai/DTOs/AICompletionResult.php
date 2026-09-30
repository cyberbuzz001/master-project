<?php

namespace App\Domain\Ai\DTOs;

readonly class AICompletionResult
{
    /**
     * @param array<int, array{tool: string, arguments: array<string, mixed>}> $toolCalls
     */
    public function __construct(
        public string $content,
        public array $toolCalls = [],
        public int $inputTokens = 0,
        public int $outputTokens = 0,
        public ?string $providerRequestId = null,
        public string $finishReason = 'stop',
        public int $latencyMs = 0,
    ) {
    }
}
