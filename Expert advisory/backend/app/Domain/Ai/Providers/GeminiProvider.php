<?php

namespace App\Domain\Ai\Providers;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Domain\Ai\DTOs\AICompletionResult;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiProvider implements AIProviderInterface
{
    public function __construct(
        protected string $apiKey = '',
        protected string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
    ) {
    }

    public function name(): string
    {
        return 'gemini';
    }

    public function complete(AICompletionRequest $request): AICompletionResult
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('Gemini API key is not configured.');
        }

        $startTime = microtime(true);

        $contents = [];
        foreach ($request->messages as $msg) {
            $role = $msg['role'] === 'assistant' ? 'model' : 'user';
            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $payload = [
            'contents' => $contents,
            'generationConfig' => [
                'temperature' => $request->temperature,
                'maxOutputTokens' => $request->maxTokens,
            ],
        ];

        if (!empty($request->systemPrompt)) {
            $payload['systemInstruction'] = [
                'parts' => [['text' => $request->systemPrompt]],
            ];
        }

        $model = $request->model ?: 'gemini-1.5-pro';
        $response = Http::timeout(60)
            ->post("{$this->baseUrl}/models/{$model}:generateContent?key={$this->apiKey}", $payload);

        if (!$response->successful()) {
            throw new RuntimeException('Gemini API request failed: ' . $response->body());
        }

        $data = $response->json();
        $candidates = $data['candidates'] ?? [];
        $firstCandidate = $candidates[0] ?? [];
        $content = $firstCandidate['content']['parts'][0]['text'] ?? '';

        $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

        return new AICompletionResult(
            content: $content,
            toolCalls: [],
            inputTokens: $data['usageMetadata']['promptTokenCount'] ?? 0,
            outputTokens: $data['usageMetadata']['candidatesTokenCount'] ?? 0,
            providerRequestId: null,
            finishReason: $firstCandidate['finishReason'] ?? 'STOP',
            latencyMs: $latencyMs,
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
        $inputPaise = ($inputTokens / 1_000_000) * 10000;
        $outputPaise = ($outputTokens / 1_000_000) * 40000;

        return (int) round($inputPaise + $outputPaise);
    }
}
