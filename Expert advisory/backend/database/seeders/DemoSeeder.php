<?php

namespace Database\Seeders;

use App\Domain\Research\DisclosureEngine;
use App\Models\CallLog;
use App\Models\Campaign;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Followup;
use App\Models\Lead;
use App\Models\LeadSource;
use App\Models\LeadStatusHistory;
use App\Models\MarketDataSnapshot;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\ResearchDistribution;
use App\Models\ResearchRecommendation;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\RiskProfile;
use App\Models\RiskQuestionnaireVersion;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Clearly-marked demo data (`is_demo = true`, "[DEMO]" names, example.test emails).
 * Refuses to run in production. No payments, testimonials, performance or registrations.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'Demo#Password2026';

    private const STAFF = [
        ['compliance_admin', 'Compliance Admin', null],
        ['research_analyst', 'Research Analyst', null],
        ['sales_manager', 'Sales Manager', null],
        ['team_leader', 'Team Leader', 'Advisory Team A'],
        ['business_advisor', 'Business Advisor', 'Advisory Team A'],
        ['senior_business_advisor', 'Senior Business Advisor', 'Advisory Team B'],
        ['payment_manager', 'Payment Manager', null],
        ['customer_support', 'Customer Support', null],
        ['auditor', 'Auditor', null],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('DemoSeeder must never run in production.');
        }

        $teams = [];
        foreach (['Advisory Team A', 'Advisory Team B'] as $name) {
            $teams[$name] = Team::query()->withoutGlobalScopes()->firstOrCreate(['name' => "[DEMO] {$name}"], ['is_demo' => true]);
        }

        $employees = [];
        foreach (self::STAFF as [$role, $label, $team]) {
            $user = User::query()->withoutGlobalScopes()->firstOrCreate(
                ['email' => str_replace('_', '.', $role).'@demo.example.test'],
                ['name' => "[DEMO] {$label}", 'password' => self::PASSWORD, 'user_type' => User::TYPE_STAFF, 'status' => User::STATUS_ACTIVE, 'is_demo' => true],
            );
            $user->syncRoles([$role]);

            $employee = Employee::query()->withoutGlobalScopes()->firstOrCreate(
                ['user_id' => $user->id],
                ['employee_code' => 'DEMO-'.$user->id, 'designation' => $label, 'team_id' => $team ? $teams[$team]->id : null, 'is_demo' => true],
            );
            $employees[$role] = $employee;
        }

        $employees['research_analyst']->forceFill([
            'is_authorized_research_person' => true,
            'research_authorized_at' => now()->subMonths(6),
        ])->save();

        $employees['compliance_admin']->forceFill([
            'is_authorized_research_person' => true,
            'research_authorized_at' => now()->subMonths(12),
        ])->save();

        $teams['Advisory Team A']->forceFill(['leader_employee_id' => $employees['team_leader']->id])->save();

        $clientUser = User::query()->withoutGlobalScopes()->firstOrCreate(
            ['email' => 'client@demo.example.test'],
            ['name' => '[DEMO] Client', 'password' => self::PASSWORD, 'user_type' => User::TYPE_CLIENT, 'status' => User::STATUS_ACTIVE, 'is_demo' => true],
        );
        $clientUser->syncRoles(['client']);

        /** @var Client $clientModel */
        $clientModel = $clientUser->client()->withoutGlobalScopes()->firstOrCreate([], [
            'client_code' => 'DEMO-C-'.$clientUser->id,
            'full_name' => '[DEMO] Client',
            'email' => $clientUser->email,
            'is_demo' => true,
            'relationship_manager_employee_id' => $employees['business_advisor']->id,
        ]);

        $this->seedClientRiskAndSubscription($clientModel);
        $this->seedMarketData();
        $this->seedResearchDesk($employees, $clientModel);
        $this->seedLeads($employees);

        $this->command?->info('Demo data seeded. Demo password for *@demo.example.test accounts: '.self::PASSWORD);
    }

    private function seedClientRiskAndSubscription(Client $clientModel): void
    {
        if (! $clientModel->riskProfiles()->exists()) {
            $questionnaireVersion = RiskQuestionnaireVersion::query()->first();
            if ($questionnaireVersion) {
                $rp = new RiskProfile();
                $rp->forceFill([
                    'client_id' => $clientModel->id,
                    'risk_questionnaire_version_id' => $questionnaireVersion->id,
                    'raw_score' => 22,
                    'max_score' => 60,
                    'risk_category' => 'moderate',
                    'methodology_version' => $questionnaireVersion->methodology_version,
                    'status' => RiskProfile::FINALIZED,
                    'answers_sha256' => hash('sha256', 'demo-answers'),
                    'finalized_at' => now()->subDays(5),
                    'expires_at' => now()->addDays(360),
                    'is_demo' => true,
                ])->save();
            }
        }

        $service = Service::firstOrCreate(
            ['code' => 'equity_research'],
            ['name' => 'Equity Research Advisory', 'category' => 'research', 'summary' => 'Comprehensive technical & fundamental equity research', 'description' => 'Institutional-grade research notes and recommendations with full regulatory disclosures.']
        );

        $plan = Plan::firstOrCreate(
            ['code' => 'equity_pro_quarterly'],
            ['service_id' => $service->id, 'name' => 'Equity Pro Quarterly', 'billing_cycle' => 'quarterly', 'duration_days' => 90, 'is_active' => true]
        );

        $planVersion = PlanVersion::firstOrCreate(
            ['plan_id' => $plan->id, 'version' => 1],
            [
                'base_price_paise' => 1500000,
                'currency' => 'INR',
                'tax_code' => 'GST_18',
                'price_includes_tax' => false,
                'effective_from' => now()->subMonths(1),
                'inclusions' => ['Research reports', 'Suitability matching', 'Real-time alert notifications'],
                'status' => PlanVersion::PUBLISHED,
                'published_at' => now()->subMonths(1),
            ]
        );

        if (! $clientModel->subscriptions()->exists()) {
            Subscription::create([
                'client_id' => $clientModel->id,
                'plan_version_id' => $planVersion->id,
                'starts_on' => now()->subDays(15),
                'ends_on' => now()->addDays(75),
                'status' => Subscription::ACTIVE,
                'activated_at' => now()->subDays(15),
                'is_demo' => true,
            ]);
        }
    }

    private function seedMarketData(): void
    {
        $snapshots = [
            ['symbol' => 'INFY.NS', 'last' => 1520.40, 'open' => 1505.00, 'high' => 1535.00, 'low' => 1500.00, 'prev_close' => 1502.50, 'change' => 17.90, 'change_pct' => 1.19, 'volume' => 4500000],
            ['symbol' => 'RELIANCE.NS', 'last' => 2940.80, 'open' => 2920.00, 'high' => 2955.00, 'low' => 2915.00, 'prev_close' => 2918.00, 'change' => 22.80, 'change_pct' => 0.78, 'volume' => 3200000],
            ['symbol' => 'TCS.NS', 'last' => 3850.00, 'open' => 3820.00, 'high' => 3865.00, 'low' => 3810.00, 'prev_close' => 3815.00, 'change' => 35.00, 'change_pct' => 0.92, 'volume' => 1800000],
            ['symbol' => 'HDFCBANK.NS', 'last' => 1645.50, 'open' => 1638.00, 'high' => 1655.00, 'low' => 1635.00, 'prev_close' => 1640.00, 'change' => 5.50, 'change_pct' => 0.34, 'volume' => 5200000],
        ];

        foreach ($snapshots as $snap) {
            $payload = [
                'symbol' => $snap['symbol'],
                'exchange' => 'NSE',
                'last_price' => $snap['last'],
                'open_price' => $snap['open'],
                'high_price' => $snap['high'],
                'low_price' => $snap['low'],
                'previous_close' => $snap['prev_close'],
                'change' => $snap['change'],
                'change_percent' => $snap['change_pct'],
                'volume' => $snap['volume'],
                'as_of' => now()->toIso8601String(),
            ];
            $json = json_encode($payload, JSON_THROW_ON_ERROR);
            MarketDataSnapshot::query()->firstOrCreate(
                ['symbol' => $snap['symbol'], 'dataset' => 'quote'],
                [
                    'provider' => 'mock',
                    'exchange' => 'NSE',
                    'payload_sha256' => hash('sha256', $json),
                    'payload' => $payload,
                    'as_of' => now(),
                    'retrieved_at' => now(),
                    'is_stale' => false,
                ]
            );
        }
    }

    /**
     * @param array<string, Employee> $employees
     */
    private function seedResearchDesk(array $employees, Client $clientModel): void
    {
        if (ResearchReport::query()->where('is_demo', true)->exists()) {
            return;
        }

        $report1 = ResearchReport::create([
            'report_code' => 'DEMO-INFY-2026',
            'title' => '[DEMO] Infosys (INFY.NS) - Q2 Margin Expansion & Cloud Pipeline Surge',
            'report_type' => 'equity_recommendation',
            'category' => 'research_report',
            'archive_status' => 'active',
            'is_demo' => true,
        ]);

        $body1 = "# Infosys Q2 Financial & Valuation Review\n\n### Investment Summary\nInfosys continues to see strong cloud transformation deal flow with large BFSI and European enterprise renewals.\n\n### Technical View\nThe stock has broken out of an ascending triangle with expanding volume.";
        $hash1 = hash('sha256', $body1);

        $version1 = ResearchVersion::create([
            'research_report_id' => $report1->id,
            'version' => 1,
            'title' => $report1->title,
            'summary' => 'Infosys showcases robust operating margin expansion and 18% YoY growth in active large-deal pipeline.',
            'body' => $body1,
            'author_employee_id' => $employees['research_analyst']->id,
            'status' => 'PUBLISHED',
            'content_hash' => $hash1,
            'published_at' => now()->subDays(2),
            'publisher_id' => $employees['compliance_admin']->user_id,
        ]);

        $report1->forceFill(['current_version_id' => $version1->id])->save();

        ResearchRecommendation::create([
            'research_version_id' => $version1->id,
            'instrument' => 'INFY.NS',
            'exchange' => 'NSE',
            'segment' => 'EQUITY_CASH',
            'direction' => 'BUY',
            'entry_low' => 1480.00,
            'entry_high' => 1510.00,
            'stop_loss' => 1410.00,
            'targets' => [1600.00, 1680.00],
            'time_horizon' => 'medium_term',
            'risk_classification' => 'MODERATE',
            'risk_reward' => 2.14,
            'status' => 'ACTIVE',
        ]);

        app(DisclosureEngine::class)->bindDisclosures($version1, [
            'has_financial_interest' => false,
            'has_beneficial_ownership' => false,
            'has_conflict_of_interest' => false,
        ]);

        ResearchDistribution::create([
            'research_version_id' => $version1->id,
            'client_id' => $clientModel->id,
            'channel' => 'PORTAL',
            'sent_at' => now()->subDays(2),
            'delivery_status' => 'DELIVERED',
        ]);

        $report2 = ResearchReport::create([
            'report_code' => 'DEMO-RELIANCE-2026',
            'title' => '[DEMO] Reliance Industries - Refining Margins & Retail Growth Analysis',
            'report_type' => 'equity_recommendation',
            'category' => 'research_report',
            'archive_status' => 'active',
            'is_demo' => true,
        ]);

        $body2 = "# Reliance Industries Strategic Valuation\n\nResilient gross refining margins and accelerating digital services revenue justify an upside stance.";
        $version2 = ResearchVersion::create([
            'research_report_id' => $report2->id,
            'version' => 1,
            'title' => $report2->title,
            'summary' => 'Refining margins stabilizing with strong momentum in Jio and Retail.',
            'body' => $body2,
            'author_employee_id' => $employees['research_analyst']->id,
            'status' => 'COMPLIANCE_REVIEW',
            'content_hash' => hash('sha256', $body2),
        ]);

        $report2->forceFill(['current_version_id' => $version2->id])->save();

        ResearchRecommendation::create([
            'research_version_id' => $version2->id,
            'instrument' => 'RELIANCE.NS',
            'exchange' => 'NSE',
            'segment' => 'EQUITY_CASH',
            'direction' => 'BUY',
            'entry_low' => 2920.00,
            'entry_high' => 2945.00,
            'stop_loss' => 2840.00,
            'targets' => [3050.00, 3150.00],
            'time_horizon' => 'short_term',
            'risk_classification' => 'MODERATE',
            'risk_reward' => 2.25,
            'status' => 'ACTIVE',
        ]);
    }

    /**
     * @param array<string, Employee> $employees
     */
    private function seedLeads(array $employees): void
    {
        if (Lead::query()->withoutGlobalScopes()->where('is_demo', true)->exists()) {
            return;
        }

        $campaign = Campaign::query()->withoutGlobalScopes()->firstOrCreate(['code' => 'demo-webinar-sep'], ['name' => '[DEMO] Risk management webinar', 'channel' => 'webinar', 'is_demo' => true]);
        $sources = LeadSource::query()->pluck('id', 'code');

        $assignees = [$employees['business_advisor'], $employees['senior_business_advisor'], $employees['team_leader']];
        $statuses = ['NEW', 'NPC', 'CALL_BACK', 'FOLLOW_UP', 'FREE_TRIAL', 'NOT_INTERESTED'];

        for ($i = 1; $i <= 18; $i++) {
            $assignee = $assignees[$i % 3];
            $lead = Lead::forceCreate([
                'full_name' => "[DEMO] Prospect {$i}",
                'mobile' => sprintf('+9190000%05d', $i),
                'email' => "prospect{$i}@demo.example.test",
                'city' => ['Mumbai', 'Pune', 'Indore', 'Jabalpur'][$i % 4],
                'preferred_segments' => [['equity'], ['options'], ['equity', 'futures']][$i % 3],
                'lead_source_id' => $sources[['website_form', 'webinar', 'organic_search'][$i % 3]] ?? null,
                'campaign_id' => $i % 3 === 1 ? $campaign->id : null,
                'assigned_employee_id' => $assignee->id,
                'is_demo' => true,
            ]);
            $status = $statuses[$i % count($statuses)];
            $lead->forceFill([
                'status' => $status,
                'next_followup_at' => in_array($status, ['CALL_BACK', 'FOLLOW_UP'], true) ? now()->addHours($i) : null,
            ])->save();
            LeadStatusHistory::create(['lead_id' => $lead->id, 'from_status' => null, 'to_status' => $status, 'reason' => 'Demo seed']);

            if ($status !== 'NEW') {
                CallLog::forceCreate([
                    'lead_id' => $lead->id, 'employee_id' => $assignee->id, 'direction' => 'outbound',
                    'outcome' => $status === 'NPC' ? 'no_answer' : 'connected', 'duration_seconds' => $status === 'NPC' ? null : 60 * ($i % 7 + 1),
                    'notes' => '[DEMO] Sample call note', 'called_at' => now()->subHours($i), 'is_demo' => true,
                ]);
                $lead->forceFill(['last_contacted_at' => now()->subHours($i)])->save();
            }

            if (in_array($status, ['CALL_BACK', 'FOLLOW_UP'], true)) {
                $due = $i % 2 === 0 ? now()->subHours(1) : now()->addHours($i);
                Followup::forceCreate([
                    'lead_id' => $lead->id, 'employee_id' => $assignee->id, 'channel' => 'call',
                    'due_at' => $due, 'status' => Followup::PENDING, 'notes' => '[DEMO] Sample follow-up', 'is_demo' => true,
                ]);
                $lead->forceFill(['next_followup_at' => $due])->save();
            }
        }
    }
}
