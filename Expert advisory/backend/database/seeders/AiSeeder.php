<?php

namespace Database\Seeders;

use App\Models\AiModel;
use App\Models\AiPrompt;
use App\Models\AiPromptVersion;
use App\Models\User;
use Illuminate\Database\Seeder;

class AiSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::first();
        if (!$admin) {
            return;
        }

        // Default mock model (always available offline/dev)
        $mockModel = AiModel::firstOrCreate(
            ['name' => 'deterministic-mock'],
            [
                'provider' => 'mock',
                'model_identifier' => 'mock-model',
                'input_cost_per_million_paise' => 0,
                'output_cost_per_million_paise' => 0,
                'is_active' => true,
            ]
        );

        // Standard OpenAI GPT-4o
        AiModel::firstOrCreate(
            ['name' => 'research-drafting-large'],
            [
                'provider' => 'openai',
                'model_identifier' => 'gpt-4o',
                'input_cost_per_million_paise' => 21000,
                'output_cost_per_million_paise' => 85000,
                'is_active' => false,
            ]
        );

        // Research Drafting prompt
        $researchPrompt = AiPrompt::firstOrCreate(
            ['key' => 'research_report_drafting'],
            [
                'title' => 'Research Report Technical Summary',
                'description' => 'Drafts structured technical thesis and analysis based on verified market indicators.',
                'target_agent' => 'TechnicalResearchAgent',
            ]
        );

        $promptVersion = AiPromptVersion::firstOrCreate(
            [
                'ai_prompt_id' => $researchPrompt->id,
                'version_number' => 1,
            ],
            [
                'system_prompt' => "You are an assistive Research Analyst AI for Expert Stocks Consultancy. Analyze deterministic indicators provided in context. Never promise or guarantee returns. Strictly adhere to SEBI Research Analyst guidelines.",
                'status' => 'approved',
                'author_id' => $admin->id,
                'approved_by_id' => $admin->id,
                'approved_at' => now(),
                'change_reason' => 'Initial baseline prompt version',
            ]
        );

        $researchPrompt->update(['active_version_id' => $promptVersion->id]);

        // CRM Lead summary prompt
        $crmPrompt = AiPrompt::firstOrCreate(
            ['key' => 'crm_lead_summary'],
            [
                'title' => 'CRM Lead Summary & Prioritization',
                'description' => 'Summarizes lead interactions, call logs, and next steps for advisors.',
                'target_agent' => 'CRMAssistantAgent',
            ]
        );

        $crmVersion = AiPromptVersion::firstOrCreate(
            [
                'ai_prompt_id' => $crmPrompt->id,
                'version_number' => 1,
            ],
            [
                'system_prompt' => "You are an assistive CRM intelligence agent for Expert Stocks Consultancy. Provide objective summaries of lead timeline and follow-ups.",
                'status' => 'approved',
                'author_id' => $admin->id,
                'approved_by_id' => $admin->id,
                'approved_at' => now(),
                'change_reason' => 'Initial baseline CRM prompt',
            ]
        );

        $crmPrompt->update(['active_version_id' => $crmVersion->id]);
    }
}
