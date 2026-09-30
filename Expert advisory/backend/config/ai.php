<?php

return [
    'default_provider' => env('AI_DEFAULT_PROVIDER', 'mock'),

    'providers' => [
        'openai' => [
            'key' => env('OPENAI_API_KEY', ''),
            'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            'default_model' => env('OPENAI_DEFAULT_MODEL', 'gpt-4o'),
        ],
        'anthropic' => [
            'key' => env('ANTHROPIC_API_KEY', ''),
            'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'),
            'default_model' => env('ANTHROPIC_DEFAULT_MODEL', 'claude-3-5-sonnet-20241022'),
        ],
        'gemini' => [
            'key' => env('GEMINI_API_KEY', ''),
            'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
            'default_model' => env('GEMINI_DEFAULT_MODEL', 'gemini-1.5-pro'),
        ],
    ],

    'guard' => [
        'enforce_grounding' => env('AI_ENFORCE_GROUNDING', true),
        'block_ungrounded_numbers' => env('AI_BLOCK_UNGROUNDED_NUMBERS', true),
        'max_budget_paise_per_month' => (int) env('AI_MAX_BUDGET_PAISE_PER_MONTH', 10000000), // 100,000 INR
    ],
];
