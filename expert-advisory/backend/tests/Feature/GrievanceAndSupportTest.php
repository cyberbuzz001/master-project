<?php

namespace Tests\Feature;

use App\Domain\Support\GrievanceService;
use App\Models\Client;
use App\Models\Grievance;
use App\Models\RegulatoryProfileVersion;
use App\Models\SupportTicket;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GrievanceAndSupportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('rbac:sync');
    }

    public function test_public_can_submit_grievance_and_receive_21_day_sla(): void
    {
        $payload = [
            'complainant_name' => 'Kavita Joshi',
            'email' => 'kavita@example.test',
            'mobile' => '+919988776655',
            'category' => 'research',
            'subject' => 'Delayed research disclosure in daily update',
            'description' => 'I noticed the risk disclosure was missing on the report dated 20th September.',
        ];

        $response = $this->postJson('/api/v1/public/grievances', $payload);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'new')
            ->assertJsonStructure(['data' => ['tracking_number', 'status', 'sla_due_at', 'message']]);

        $trackingNumber = $response->json('data.tracking_number');
        $this->assertStringStartsWith('GRV-', $trackingNumber);

        // Verify in database
        $this->assertDatabaseHas('grievances', [
            'tracking_number' => $trackingNumber,
            'complainant_name' => 'Kavita Joshi',
            'category' => 'research',
            'status' => 'new',
        ]);

        $grievance = Grievance::where('tracking_number', $trackingNumber)->first();
        // Assert 21 calendar days SLA
        $diffDays = CarbonImmutable::now()->diffInDays($grievance->sla_due_at);
        $this->assertEquals(21, (int) round($diffDays));
    }

    public function test_public_can_track_grievance_status(): void
    {
        $grievance = Grievance::create([
            'tracking_number' => 'GRV-2026-00099',
            'complainant_name' => 'Ramesh Gupta',
            'email' => 'ramesh@example.test',
            'category' => 'billing',
            'subject' => 'Duplicate payment deduction',
            'description' => 'Amount was deducted twice.',
            'status' => 'under_review',
            'sla_due_at' => CarbonImmutable::now()->addDays(20),
        ]);

        $response = $this->getJson("/api/v1/public/grievances/{$grievance->tracking_number}");

        $response->assertOk()
            ->assertJsonPath('data.tracking_number', 'GRV-2026-00099')
            ->assertJsonPath('data.status', 'under_review')
            ->assertJsonPath('data.category', 'billing');
    }

    public function test_grievance_officer_can_assign_and_resolve_grievance(): void
    {
        $officer = User::factory()->create();
        $officer->assignRole('compliance_admin');

        $grievance = Grievance::create([
            'tracking_number' => 'GRV-2026-00100',
            'complainant_name' => 'Suresh Kumar',
            'email' => 'suresh@example.test',
            'category' => 'advisory',
            'subject' => 'Unclear suitability band',
            'description' => 'Please explain why my profile is categorized as aggressive.',
            'status' => 'new',
            'sla_due_at' => CarbonImmutable::now()->addDays(21),
        ]);

        $service = new GrievanceService();

        // 1. Assign to officer
        $service->assignGrievance($grievance, $officer);
        $this->assertEquals('assigned', $grievance->fresh()->status);
        $this->assertEquals($officer->id, $grievance->fresh()->assigned_to_id);

        // 2. Resolve grievance
        $service->resolveGrievance(
            $grievance,
            'Explained mathematical risk score formula and investment horizon weightings over phone and email.',
            $officer
        );

        $fresh = $grievance->fresh();
        $this->assertEquals('resolved', $fresh->status);
        $this->assertNotNull($fresh->resolved_at);
        $this->assertEquals($officer->id, $fresh->resolved_by_id);
        $this->assertStringContainsString('Explained mathematical risk score', $fresh->resolution_notes);
    }

    public function test_client_can_create_and_reply_to_support_ticket(): void
    {
        $clientUser = User::factory()->create();
        $clientUser->assignRole('client');

        $client = Client::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-7001',
            'full_name' => 'Deepak Verma',
            'email' => 'deepak@example.test',
        ]);

        $this->actingAs($clientUser);

        // 1. Create ticket
        $createRes = $this->postJson('/api/v1/client/support/tickets', [
            'subject' => 'Cannot view invoice receipt PDF',
            'category' => 'billing',
            'message' => 'Whenever I click the receipt download button, it says loading.',
        ]);

        $createRes->assertCreated()
            ->assertJsonPath('data.status', 'open');

        $ticketNumber = $createRes->json('data.ticket_number');
        $this->assertNotEmpty($ticketNumber);

        // 2. Client replies to ticket
        $replyRes = $this->postJson("/api/v1/client/support/tickets/{$ticketNumber}/reply", [
            'message' => 'Update: I tried on Firefox and got the same issue.',
        ]);

        $replyRes->assertCreated()
            ->assertJsonPath('data.message', 'Update: I tried on Firefox and got the same issue.')
            ->assertJsonPath('data.is_staff_reply', false);

        // 3. View ticket thread
        $showRes = $this->getJson("/api/v1/client/support/tickets/{$ticketNumber}");
        $showRes->assertOk()
            ->assertJsonPath('data.ticket_number', $ticketNumber)
            ->assertJsonCount(2, 'data.messages');
    }

    public function test_system_health_endpoint_requires_permission_and_returns_diagnostics(): void
    {
        // Unauthenticated -> 401
        $this->getJson('/api/v1/admin/system/health')->assertUnauthorized();

        // Client -> 403
        $clientUser = User::factory()->create();
        $clientUser->assignRole('client');
        $this->actingAs($clientUser)->getJson('/api/v1/admin/system/health')->assertForbidden();

        // Compliance Admin -> 200 OK
        $adminUser = $this->makeStaff('compliance_admin');

        $response = $this->actingAsVerified($adminUser)->getJson('/api/v1/admin/system/health');

        $response->assertOk()
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('components.database.status', 'healthy')
            ->assertJsonPath('components.cache.status', 'healthy')
            ->assertJsonPath('components.vault_storage.status', 'healthy')
            ->assertJsonStructure([
                'status',
                'timestamp',
                'components' => ['database', 'cache', 'vault_storage', 'compliance_profile', 'system'],
            ]);
    }
}
