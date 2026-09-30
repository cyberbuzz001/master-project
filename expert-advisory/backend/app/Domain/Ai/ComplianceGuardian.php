<?php

namespace App\Domain\Ai;

use App\Models\RegulatoryProfileVersion;

class ComplianceGuardian
{
    /**
     * Prohibited phrases under SEBI (Research Analysts) Regulations, 2014
     * and SEBI Advertising Guidelines.
     */
    protected const PROHIBITED_PHRASES = [
        'guaranteed return',
        'guaranteed returns',
        'assured return',
        'assured returns',
        '100% profit',
        '100% safe',
        'risk free',
        'risk-free',
        'zero risk',
        'multibagger guarantee',
        'sure shot call',
        'sure-shot',
        'jackpot call',
        'no loss strategy',
    ];

    /**
     * Run full compliance and grounding screen on AI generated text and structured outputs.
     *
     * @param string $content
     * @param array<string, mixed> $toolResults
     * @param array<string, mixed>|null $structuredOutput
     * @return array{passed: bool, violations: array<int, string>, findings: array<int, string>}
     */
    public function screen(string $content, array $toolResults = [], ?array $structuredOutput = null): array
    {
        $violations = [];
        $findings = [];
        $lower = strtolower($content);

        // 1. Check for prohibited promotional / guaranteed returns claims
        foreach (self::PROHIBITED_PHRASES as $phrase) {
            if (str_contains($lower, $phrase)) {
                $violations[] = "PROHIBITED_CLAIM: Found prohibited promise or performance guarantee phrase '{$phrase}'.";
            }
        }

        // 2. Check SEBI registration citations against active verified regulatory profile
        $activeProfile = RegulatoryProfileVersion::where('status', 'verified')->latest('verified_at')->first();
        $expectedRegNo = $activeProfile?->registration_number;

        if (preg_match_all('/IN[H|R|A|B|C|D|E|F|G|I|J|K|L|M|N|O|P|Q|S|T|U|V|W|X|Y|Z][0-9]{9}/i', $content, $matches)) {
            foreach ($matches[0] as $foundReg) {
                if ($expectedRegNo && strtoupper($foundReg) !== strtoupper($expectedRegNo)) {
                    $violations[] = "UNVERIFIED_SEBI_REGISTRATION: Output cites SEBI registration '{$foundReg}', which differs from verified profile '{$expectedRegNo}'.";
                }
            }
        }

        // 3. Grounding check on recommendation numbers if provided in structured output
        if ($structuredOutput && isset($structuredOutput['recommendation'])) {
            $rec = $structuredOutput['recommendation'];
            $entry = $rec['entry_paise'] ?? null;
            $stopLoss = $rec['stop_loss_paise'] ?? null;
            $target = $rec['target_paise'] ?? null;

            if ($entry && $stopLoss && $target) {
                $direction = strtoupper($rec['direction'] ?? 'BUY');
                if ($direction === 'BUY' && $stopLoss >= $entry) {
                    $violations[] = "INVALID_RISK_REWARD: BUY recommendation has stop loss (₹" . ($stopLoss / 100) . ") >= entry (₹" . ($entry / 100) . ").";
                }
                if ($direction === 'BUY' && $target <= $entry) {
                    $violations[] = "INVALID_RISK_REWARD: BUY recommendation has target (₹" . ($target / 100) . ") <= entry (₹" . ($entry / 100) . ").";
                }
            }
        }

        $passed = empty($violations);

        return [
            'passed' => $passed,
            'violations' => $violations,
            'findings' => $findings,
        ];
    }
}
