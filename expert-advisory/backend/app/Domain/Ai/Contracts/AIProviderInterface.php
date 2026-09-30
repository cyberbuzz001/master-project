<?php

namespace App\Domain\Ai\Contracts;

use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Domain\Ai\DTOs\AICompletionResult;

interface AIProviderInterface
{
    public function name(): string;

    public function complete(AICompletionRequest $request): AICompletionResult;

    public function supportsTools(): bool;

    public function supportsJsonSchema(): bool;

    /**
     * Estimate cost in integer paise
     */
    public function estimateCost(string $model, int $inputTokens, int $outputTokens): int;
}
