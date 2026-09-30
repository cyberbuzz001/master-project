<?php

namespace App\Domain\Ai\Providers;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Domain\Ai\DTOs\AICompletionResult;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAIProvider implements AIProviderInterface
{
    public function __construct(
        protected string $apiKey = '',
        protected string $baseUrl = 'https://api.openai.com/v1',
    ) {
    }

    public function name(): string
    {
        return 'openai';
    }

    public function complete(AICompletionRequest $request): AICompletionResult
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('OpenAI API key is not configured.');
        }

        $startTime = microtime(true);

        $messages = [];
        if (!empty($request->systemPrompt)) {
            $messages[] = ['role' => 'system', 'content' => $request->systemPrompt];
        }
        foreach ($request->messages as $msg) {
            $messages[] = $msg;
        }

        $payload = [
            'model' => $request->model,
            'messages' => $messages,
            'temperature' => $request->temperature,
            'max_tokens' => $request->maxTokens,
        ];

        if (!empty($request->tools)) {
            $payload['tools'] = array_map(fn($t) => [
                'type' => 'function',
                'function' => [
                    'name' => $t['name'],
                    'description' => $t['description'] ?? '',
                    'parameters' => $t['parameters'] ?? new \stdClass(),
                ],
            ], $request->tools);
        }

        if ($request->jsonSchema !== null) {
            $payload['response_format'] = [
                'type' => 'json_schema',
                'json_schema' => [
                    'name' => 'response',
                    'schema' => $request->jsonSchema,
                ],
            ];
        }

        $response = Http::withToken($this->apiKey)
            ->timeout(60)
            ->post("{$this->baseUrl}/chat/completions", $payload);

        if (!$response->successful()) {
            throw new RuntimeException('OpenAI API request failed: ' . $response->body());
        }

        $data = $response->json();
        $choice = $data['choices'][0] ?? [];
        $message = $choice['message'] ?? [];

        $toolCalls = [];
        if (!empty($message['tool_calls'])) {
            foreach ($message['tool_calls'] as $tc) {
                $toolCalls[] = [
                    'tool' => $tc['function']['name'] ?? '',
                    'arguments' => json_decode($tc['function']['arguments'] ?? '{}', true) ?: [],
                ];
            }
        }

        $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

        return new AICompletionResult(
            content: $message['content'] ?? '',
            toolCalls: $toolCalls,
            inputTokens: $data['usage']['prompt_tokens'] ?? 0,
            outputTokens: $data['usage']['completion_tokens'] ?? 0,
            providerRequestId: $data['id'] ?? null,
            finishReason: $choice['finish_reason'] ?? 'stop',
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
        // Default estimate in paise (approx 85 INR per USD)
        // e.g. GPT-4o: ~$2.50 / 1M input (~21 paise / 1k), ~$10 / 1M output (~85 paise / 1k)
        $inputPaise = ($inputTokens / 1_000_000) * 21000;
        $outputPaise = ($outputTokens / 1_000_000) * 85000;

        return (int) round($inputPaise + $outputPaise);
    }
}
