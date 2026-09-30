<?php

namespace App\Domain\Ai\Providers;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Domain\Ai\DTOs\AICompletionResult;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AnthropicProvider implements AIProviderInterface
{
    public function __construct(
        protected string $apiKey = '',
        protected string $baseUrl = 'https://api.anthropic.com/v1',
    ) {
    }

    public function name(): string
    {
        return 'claude';
    }

    public function complete(AICompletionRequest $request): AICompletionResult
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('Anthropic API key is not configured.');
        }

        $startTime = microtime(true);

        $payload = [
            'model' => $request->model,
            'messages' => $request->messages,
            'max_tokens' => $request->maxTokens,
            'temperature' => $request->temperature,
        ];

        if (!empty($request->systemPrompt)) {
            $payload['system'] = $request->systemPrompt;
        }

        if (!empty($request->tools)) {
            $payload['tools'] = array_map(fn($t) => [
                'name' => $t['name'],
                'description' => $t['description'] ?? '',
                'input_schema' => $t['parameters'] ?? new \stdClass(),
            ], $request->tools);
        }

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])
            ->timeout(60)
            ->post("{$this->baseUrl}/messages", $payload);

        if (!$response->successful()) {
            throw new RuntimeException('Anthropic API request failed: ' . $response->body());
        }

        $data = $response->json();
        $content = '';
        $toolCalls = [];

        foreach ($data['content'] ?? [] as $block) {
            if ($block['type'] === 'text') {
                $content .= $block['text'];
            } elseif ($block['type'] === 'tool_use') {
                $toolCalls[] = [
                    'tool' => $block['name'],
                    'arguments' => $block['input'] ?? [],
                ];
            }
        }

        $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

        return new AICompletionResult(
            content: $content,
            toolCalls: $toolCalls,
            inputTokens: $data['usage']['input_tokens'] ?? 0,
            outputTokens: $data['usage']['output_tokens'] ?? 0,
            providerRequestId: $data['id'] ?? null,
            finishReason: $data['stop_reason'] ?? 'end_turn',
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
        $inputPaise = ($inputTokens / 1_000_000) * 25000;
        $outputPaise = ($outputTokens / 1_000_000) * 125000;

        return (int) round($inputPaise + $outputPaise);
    }
}
