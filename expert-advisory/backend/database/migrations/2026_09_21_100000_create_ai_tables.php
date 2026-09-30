<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Logical AI models configured in the system
        Schema::create('ai_models', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // e.g. 'research-drafting', 'crm-assistant', 'compliance-guardian'
            $table->string('provider'); // 'openai', 'gemini', 'claude', 'local', 'mock'
            $table->string('model_identifier'); // e.g. 'gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'
            $table->decimal('input_cost_per_million_paise', 10, 2)->default(0);
            $table->decimal('output_cost_per_million_paise', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->json('parameters')->nullable(); // temperature, max_tokens, etc.
            $table->timestamps();
        });

        // AI System Prompts and versioning
        Schema::create('ai_prompts', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // e.g. 'research_report_drafting', 'crm_lead_summary', 'compliance_guardian_screen'
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('target_agent'); // e.g. 'TechnicalResearchAgent', 'CRMAssistantAgent', 'ComplianceGuardianAgent'
            $table->foreignId('active_version_id')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_prompt_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_prompt_id')->constrained()->cascadeOnDelete();
            $table->integer('version_number');
            $table->longText('system_prompt');
            $table->json('input_schema')->nullable();
            $table->json('output_schema')->nullable();
            $table->string('status')->default('draft'); // draft, in_review, approved, retired
            $table->foreignId('author_id')->constrained('users');
            $table->foreignId('approved_by_id')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('change_reason')->nullable();
            $table->timestamps();

            $table->unique(['ai_prompt_id', 'version_number']);
        });

        // Audit log of every AI run
        Schema::create('ai_runs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('agent');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ai_model_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ai_prompt_version_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('pending'); // pending, completed, failed, blocked_by_guardian
            $table->integer('input_tokens')->default(0);
            $table->integer('output_tokens')->default(0);
            $table->unsignedBigInteger('estimated_cost_paise')->default(0);
            $table->unsignedInteger('latency_ms')->default(0);
            $table->json('input_context')->nullable();
            $table->longText('raw_output')->nullable();
            $table->json('structured_output')->nullable();
            $table->boolean('grounding_passed')->default(true);
            $table->json('grounding_violations')->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamps();

            $table->index(['agent', 'status']);
            $table->index(['created_at']);
        });

        // Audit log of AI tool calls
        Schema::create('ai_tool_calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_run_id')->constrained()->cascadeOnDelete();
            $table->string('tool_name');
            $table->string('arguments_hash', 64);
            $table->json('arguments')->nullable();
            $table->json('result')->nullable();
            $table->unsignedInteger('duration_ms')->default(0);
            $table->boolean('is_allowed')->default(true);
            $table->string('blocked_reason')->nullable();
            $table->timestamps();

            $table->index(['ai_run_id', 'tool_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_tool_calls');
        Schema::dropIfExists('ai_runs');
        Schema::dropIfExists('ai_prompt_versions');
        Schema::dropIfExists('ai_prompts');
        Schema::dropIfExists('ai_models');
    }
};
