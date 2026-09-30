<?php

namespace App\Domain\Ai;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\Providers\AnthropicProvider;
use App\Domain\Ai\Providers\GeminiProvider;
use App\Domain\Ai\Providers\MockAIProvider;
use App\Domain\Ai\Providers\OpenAIProvider;
use InvalidArgumentException;

class AIProviderFactory
{
    public static function make(?string $providerName = null): AIProviderInterface
    {
        $provider = $providerName ?: config('ai.default_provider', 'mock');

        return match ($provider) {
            'openai' => new OpenAIProvider(
                apiKey: config('ai.providers.openai.key', ''),
                baseUrl: config('ai.providers.openai.base_url', 'https://api.openai.com/v1')
            ),
            'claude', 'anthropic' => new AnthropicProvider(
                apiKey: config('ai.providers.anthropic.key', ''),
                baseUrl: config('ai.providers.anthropic.base_url', 'https://api.anthropic.com/v1')
            ),
            'gemini' => new GeminiProvider(
                apiKey: config('ai.providers.gemini.key', ''),
                baseUrl: config('ai.providers.gemini.base_url', 'https://generativelanguage.googleapis.com/v1beta')
            ),
            'mock', 'local' => new MockAIProvider(),
            default => new MockAIProvider(),
        };
    }
}
