<?php

namespace App\Domain\Ai;

use App\Domain\Ai\Contracts\AIProviderInterface;
use App\Domain\Ai\DTOs\AICompletionRequest;
use App\Models\AiModel;
use App\Models\AiPrompt;
use App\Models\AiRun;
use App\Models\AiToolCall;
use App\Models\User;
use Exception;
use Illuminate\Support\Str;

class AiService
{
    public function __construct(
        protected ToolGateway $toolGateway,
        protected ComplianceGuardian $guardian,
    ) {
    }

    /**
     * Execute an AI agent task with prompt retrieval, tool execution, grounding validation,
     * and full audit logging in `ai_runs`.
     *
     * @param string $promptKey e.g. 'research_assistant', 'crm_lead_summary'
     * @param array<string, mixed> $context
     * @param ?User $user
     * @return AiRun
     */
    public function executeAgent(string $promptKey, array $context, ?User $user = null): AiRun
    {
        $prompt = AiPrompt::with('activeVersion')->where('key', $promptKey)->first();
        $promptVersion = $prompt?->activeVersion;

        // Resolve logical model
        $modelRecord = AiModel::where('is_active', true)->first();
        $providerName = $modelRecord?->provider ?: config('ai.default_provider', 'mock');
        $modelIdentifier = $modelRecord?->model_identifier ?: 'mock-model';

        $provider = AIProviderFactory::make($providerName);

        $systemPrompt = $promptVersion?->system_prompt
            ?: "You are an assistive financial intelligence AI for Expert Stocks Consultancy. Strictly adhere to SEBI regulations. Never guarantee profits.";

        $userMessage = "Context: " . json_encode($context);

        $tools = $this->toolGateway->getToolDefinitions();

        $request = new AICompletionRequest(
            model: $modelIdentifier,
            systemPrompt: $systemPrompt,
            messages: [
                ['role' => 'user', 'content' => $userMessage],
            ],
            tools: $tools,
            temperature: 0.2,
            maxTokens: 2000,
            runUuid: (string) Str::uuid(),
        );

        // Create run record in pending state
        $run = AiRun::create([
            'uuid' => $request->runUuid,
            'agent' => $prompt?->target_agent ?? $promptKey,
            'user_id' => $user?->id,
            'ai_model_id' => $modelRecord?->id,
            'ai_prompt_version_id' => $promptVersion?->id,
            'status' => 'pending',
            'input_context' => $context,
        ]);

        try {
            $result = $provider->complete($request);

            // Execute any tool calls returned by the provider
            $toolResults = [];
            foreach ($result->toolCalls as $call) {
                $toolName = $call['tool'] ?? '';
                $toolArgs = $call['arguments'] ?? [];
                $startTool = microtime(true);

                try {
                    $toolOutput = $this->toolGateway->execute($toolName, $toolArgs, $user);
                    $durationMs = (int) round((microtime(true) - $startTool) * 1000);

                    AiToolCall::create([
                        'ai_run_id' => $run->id,
                        'tool_name' => $toolName,
                        'arguments_hash' => hash('sha256', json_encode($toolArgs)),
                        'arguments' => $toolArgs,
                        'result' => $toolOutput,
                        'duration_ms' => $durationMs,
                        'is_allowed' => true,
                    ]);

                    $toolResults[$toolName] = $toolOutput;
                } catch (Exception $e) {
                    AiToolCall::create([
                        'ai_run_id' => $run->id,
                        'tool_name' => $toolName,
                        'arguments_hash' => hash('sha256', json_encode($toolArgs)),
                        'arguments' => $toolArgs,
                        'result' => ['error' => $e->getMessage()],
                        'duration_ms' => 0,
                        'is_allowed' => false,
                        'blocked_reason' => $e->getMessage(),
                    ]);
                }
            }

            // Run compliance and grounding validation
            $screenResult = $this->guardian->screen($result->content, $toolResults);

            $costPaise = $provider->estimateCost($modelIdentifier, $result->inputTokens, $result->outputTokens);

            $status = $screenResult['passed'] ? 'completed' : 'blocked_by_guardian';

            $run->update([
                'status' => $status,
                'input_tokens' => $result->inputTokens,
                'output_tokens' => $result->outputTokens,
                'estimated_cost_paise' => $costPaise,
                'latency_ms' => $result->latencyMs,
                'raw_output' => $result->content,
                'grounding_passed' => $screenResult['passed'],
                'grounding_violations' => $screenResult['violations'],
            ]);

            return $run;
        } catch (Exception $e) {
            $run->update([
                'status' => 'failed',
                'failure_reason' => $e->getMessage(),
            ]);

            return $run;
        }
    }
}
