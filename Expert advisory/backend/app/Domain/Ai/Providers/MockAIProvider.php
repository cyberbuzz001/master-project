<?php

namespace App\Domain\Ai\Providers;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Domain\Ai\DTOs\AICompletionResult;

class MockAIProvider implements AIProviderInterface
{
    /** @var array<string, mixed>|null */
    protected static ?array $cannedResponses = null;

    public function name(): string
    {
        return 'mock';
    }

    public function complete(AICompletionRequest $request): AICompletionResult
    {
        $startTime = microtime(true);

        // Check if there is a canned response configured
        if (self::$cannedResponses !== null && isset(self::$cannedResponses[$request->model])) {
            $canned = self::$cannedResponses[$request->model];
            return new AICompletionResult(
                content: $canned['content'] ?? 'Mock response',
                toolCalls: $canned['tool_calls'] ?? [],
                inputTokens: 120,
                outputTokens: 80,
                providerRequestId: 'mock-' . bin2hex(random_bytes(8)),
                finishReason: 'stop',
                latencyMs: (int) round((microtime(true) - $startTime) * 1000),
            );
        }

        // Default deterministic response generator based on system prompt / agent
        $content = "AI Analysis (Mock/Deterministic Mode): Analysis verified against deterministic technical indicators and market snapshot. All statutory disclosures applied.";

        return new AICompletionResult(
            content: $content,
            toolCalls: [],
            inputTokens: 150,
            outputTokens: 75,
            providerRequestId: 'mock-' . bin2hex(random_bytes(8)),
            finishReason: 'stop',
            latencyMs: 15,
        );
    }

    public function supportsTools(): bool
    {
        return true;
    }

    public function supportsJsonSchema(): bool
    {
        return true;
    }

    public function estimateCost(string $model, int $inputTokens, int $outputTokens): int
    {
        // Free for mock (0 paise)
        return 0;
    }

    /**
     * @param array<string, mixed>|null $responses
     */
    public static function setCannedResponses(?array $responses): void
    {
        self::$cannedResponses = $responses;
    }
}
