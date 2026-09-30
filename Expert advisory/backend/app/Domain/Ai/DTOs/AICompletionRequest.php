<?php

namespace App\Domain\Ai\DTOs;

readonly class AICompletionRequest
{
    /**
     * @param array<int, array{role: string, content: string}> $messages
     * @param array<int, array<string, mixed>> $tools
     * @param array<string, mixed>|null $jsonSchema
     */
    public function __construct(
        public string $model,
        public string $systemPrompt,
        public array $messages,
        public array $tools = [],
        public ?array $jsonSchema = null,
        public float $temperature = 0.2,
        public int $maxTokens = 2000,
        public ?string $runUuid = null,
    ) {
    }
}
