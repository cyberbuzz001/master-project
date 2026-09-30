<?php

namespace Database\Seeders;

use App\Models\Agreement;
use App\Models\RiskQuestion;
use App\Models\RiskQuestionnaire;
use App\Models\RiskQuestionnaireVersion;
use Illuminate\Database\Seeder;

/**
 * Seeds the onboarding scaffolding: a suitability questionnaire as a DRAFT for compliance to review
 * and publish, and the agreement containers. Agreement text is deliberately not seeded — legal
 * wording must be written and approved by the firm, not generated.
 */
class OnboardingSeeder extends Seeder
{
    public function run(): void
    {
        $this->questionnaire();

        foreach ([
            ['code' => 'client_agreement', 'title' => 'Client service agreement', 'description' => 'Terms between the firm and the client for advisory or research services.'],
            ['code' => 'fee_schedule', 'title' => 'Fee schedule acknowledgement', 'description' => 'Fees, billing cycle and refund terms acknowledged by the client.'],
            ['code' => 'risk_disclosure', 'title' => 'Risk disclosure acknowledgement', 'description' => 'Client confirms they have read the risk disclosure.'],
        ] as $agreement) {
            Agreement::firstOrCreate(['code' => $agreement['code']], $agreement + ['requires_client_acceptance' => true, 'is_active' => true]);
        }
    }

    private function questionnaire(): void
    {
        $questionnaire = RiskQuestionnaire::firstOrCreate(
            ['code' => 'suitability'],
            ['title' => 'Investor suitability and risk profile', 'description' => 'Captures experience, objectives, horizon and capacity for loss.'],
        );

        if ($questionnaire->versions()->exists()) {
            return;
        }

        $version = new RiskQuestionnaireVersion([
            'risk_questionnaire_id' => $questionnaire->id,
            'version' => 1,
            'methodology_version' => 'suitability-1.0',
            'valid_for_days' => 365,
            'bands' => [
                ['key' => 'conservative', 'label' => 'Conservative', 'min_score' => 0, 'max_score' => 12, 'description' => 'Prefers capital preservation over growth.', 'suitability' => ['avoid_leverage', 'avoid_derivatives']],
                ['key' => 'moderate', 'label' => 'Moderate', 'min_score' => 13, 'max_score' => 24, 'description' => 'Accepts measured fluctuations for long-term growth.', 'suitability' => ['avoid_leverage']],
                ['key' => 'balanced', 'label' => 'Balanced', 'min_score' => 25, 'max_score' => 34, 'description' => 'Comfortable with market cycles and drawdowns.', 'suitability' => []],
                ['key' => 'aggressive', 'label' => 'Aggressive', 'min_score' => 35, 'max_score' => 60, 'description' => 'Experienced, accepts large drawdowns and concentrated positions.', 'suitability' => []],
            ],
        ]);
        $version->save();

        $questions = [
            ['code' => 'experience', 'text' => 'How long have you been investing or trading in the markets?', 'weight' => 2, 'options' => [
                ['label' => 'Less than a year', 'value' => 'lt_1y', 'score' => 0],
                ['label' => '1 to 3 years', 'value' => '1_3y', 'score' => 2],
                ['label' => '3 to 7 years', 'value' => '3_7y', 'score' => 4],
                ['label' => 'More than 7 years', 'value' => 'gt_7y', 'score' => 5],
            ]],
            ['code' => 'horizon', 'text' => 'How long can you stay invested without needing this money?', 'weight' => 2, 'options' => [
                ['label' => 'Under 1 year', 'value' => 'lt_1y', 'score' => 0, 'flags' => ['short_horizon']],
                ['label' => '1 to 3 years', 'value' => '1_3y', 'score' => 2],
                ['label' => '3 to 5 years', 'value' => '3_5y', 'score' => 4],
                ['label' => 'Over 5 years', 'value' => 'gt_5y', 'score' => 5],
            ]],
            ['code' => 'loss_tolerance', 'text' => 'If your portfolio fell 20% in three months, what would you do?', 'weight' => 2, 'options' => [
                ['label' => 'Exit everything immediately', 'value' => 'exit', 'score' => 0, 'flags' => ['low_loss_tolerance']],
                ['label' => 'Reduce exposure and wait', 'value' => 'reduce', 'score' => 2],
                ['label' => 'Hold and review the plan', 'value' => 'hold', 'score' => 4],
                ['label' => 'Invest more at lower levels', 'value' => 'add', 'score' => 5],
            ]],
            ['code' => 'income_stability', 'text' => 'How stable is your income relative to your expenses?', 'weight' => 1, 'options' => [
                ['label' => 'Irregular; expenses are hard to cover', 'value' => 'unstable', 'score' => 0, 'flags' => ['income_risk']],
                ['label' => 'Stable; small surplus each month', 'value' => 'stable', 'score' => 3],
                ['label' => 'Very stable; large surplus each month', 'value' => 'strong', 'score' => 5],
            ]],
            ['code' => 'capital_share', 'text' => 'What share of your total savings would this capital represent?', 'weight' => 1, 'options' => [
                ['label' => 'Most of my savings', 'value' => 'most', 'score' => 0, 'flags' => ['concentration_risk']],
                ['label' => 'About half', 'value' => 'half', 'score' => 2],
                ['label' => 'A small part', 'value' => 'small', 'score' => 5],
            ]],
            ['code' => 'instruments', 'text' => 'Which instruments have you actually traded before?', 'type' => RiskQuestion::MULTI, 'weight' => 1, 'options' => [
                ['label' => 'Equity delivery', 'value' => 'equity', 'score' => 1],
                ['label' => 'Mutual funds', 'value' => 'mf', 'score' => 1],
                ['label' => 'Futures and options', 'value' => 'fno', 'score' => 3],
                ['label' => 'Commodities or currency', 'value' => 'commodity', 'score' => 2],
            ]],
        ];

        $order = 0;

        foreach ($questions as $definition) {
            $question = RiskQuestion::create([
                'risk_questionnaire_version_id' => $version->id,
                'code' => $definition['code'],
                'text' => $definition['text'],
                'type' => $definition['type'] ?? RiskQuestion::SINGLE,
                'weight' => $definition['weight'],
                'sort_order' => $order++,
                'is_required' => true,
            ]);

            $optionOrder = 0;

            foreach ($definition['options'] as $option) {
                $question->options()->create([
                    'label' => $option['label'],
                    'value' => $option['value'],
                    'score' => $option['score'],
                    'suitability_flags' => $option['flags'] ?? null,
                    'sort_order' => $optionOrder++,
                ]);
            }
        }
    }
}
