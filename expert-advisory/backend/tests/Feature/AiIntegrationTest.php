<?php

namespace Tests\Feature;

use App\Domain\Ai\AiService;
use App\Domain\Ai\ComplianceGuardian;
use App\Domain\Ai\Providers\MockAIProvider;
use App\Domain\Ai\ToolGateway;
use App\Models\AiModel;
use App\Models\AiPrompt;
use App\Models\AiPromptVersion;
use App\Models\AiRun;
use App\Models\MarketDataSnapshot;
use App\Models\RegulatoryProfileVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('rbac:sync');
    }

    public function test_compliance_guardian_blocks_prohibited_guarantee_claims(): void
    {
        $guardian = new ComplianceGuardian();

        $textWithGuarantee = "We recommend buying RELIANCE at 2900 with guaranteed returns of 25% within 1 month.";
        $result = $guardian->screen($textWithGuarantee);

        $this->assertFalse($result['passed']);
        $this->assertNotEmpty($result['violations']);
        $this->assertStringContainsString('PROHIBITED_CLAIM', $result['violations'][0]);
    }

    public function test_compliance_guardian_verifies_sebi_registration_grounding(): void
    {
        $guardian = new ComplianceGuardian();

        // Create verified regulatory profile with a valid SEBI number
        $creator = User::factory()->create();
        $verifier = User::factory()->create();

        $profile = new RegulatoryProfileVersion([
            'entity_type' => 'sebi_registered_ra',
            'legal_entity_name' => 'Expert Stocks Consultancy Pvt Ltd',
            'registration_number' => 'INH000012345',
            'registration_date' => '2024-01-15',
            'ra_name' => 'A. Analyst',
            'compliance_officer' => 'C. Officer',
            'grievance_officer_name' => 'G. Officer',
            'grievance_officer_email' => 'grievance@example.test',
            'public_statement' => 'Test statement',
        ]);
        $profile->version = 1;
        $profile->status = RegulatoryProfileVersion::VERIFIED;
        $profile->created_by = $creator->id;
        $profile->submitted_by = $creator->id;
        $profile->submitted_at = now();
        $profile->verified_by = $verifier->id;
        $profile->verified_at = now();
        $profile->save();

        // Output cites an incorrect/fabricated registration number
        $fraudulentText = "Report published by SEBI Registered Research Analyst under registration INH999999999.";
        $result = $guardian->screen($fraudulentText);

        $this->assertFalse($result['passed']);
        $this->assertStringContainsString('UNVERIFIED_SEBI_REGISTRATION', $result['violations'][0]);

        // Output cites the exact verified registration number
        $correctText = "Report published by SEBI Registered Research Analyst under registration INH000012345.";
        $validResult = $guardian->screen($correctText);
        $this->assertTrue($validResult['passed']);
    }

    public function test_tool_gateway_retrieves_verified_market_snapshot(): void
    {
        $gateway = new ToolGateway();

        MarketDataSnapshot::create([
            'provider' => 'mock',
            'dataset' => 'QUOTE',
            'symbol' => 'TCS',
            'exchange' => 'NSE',
            'payload_sha256' => hash('sha256', 'TCS'),
            'payload' => [
                'symbol' => 'TCS',
                'exchange' => 'NSE',
                'ltp' => 3850.0,
                'volume' => 1500000,
            ],
            'as_of' => now(),
            'retrieved_at' => now(),
            'is_stale' => false,
        ]);

        $output = $gateway->execute('get_market_snapshot', ['symbol' => 'TCS']);

        $this->assertEquals('TCS', $output['symbol']);
        $this->assertEquals(385000, $output['price_paise']);
        $this->assertEquals(3850.0, $output['price_inr']);
        $this->assertFalse($output['is_stale']);
    }

    public function test_ai_service_executes_agent_and_logs_audit_trail(): void
    {
        $admin = User::factory()->create();

        $model = AiModel::create([
            'name' => 'test-mock-model',
            'provider' => 'mock',
            'model_identifier' => 'mock-model',
            'is_active' => true,
        ]);

        $prompt = AiPrompt::create([
            'key' => 'research_report_drafting',
            'title' => 'Research Draft',
            'target_agent' => 'TechnicalResearchAgent',
        ]);

        $version = AiPromptVersion::create([
            'ai_prompt_id' => $prompt->id,
            'version_number' => 1,
            'system_prompt' => 'Provide technical research.',
            'status' => 'approved',
            'author_id' => $admin->id,
        ]);

        $prompt->update(['active_version_id' => $version->id]);

        $service = new AiService(new ToolGateway(), new ComplianceGuardian());

        $run = $service->executeAgent('research_report_drafting', ['symbol' => 'RELIANCE'], $admin);

        $this->assertInstanceOf(AiRun::class, $run);
        $this->assertEquals('completed', $run->status);
        $this->assertTrue($run->grounding_passed);
        $this->assertDatabaseHas('ai_runs', [
            'id' => $run->id,
            'status' => 'completed',
            'agent' => 'TechnicalResearchAgent',
        ]);
    }
}
