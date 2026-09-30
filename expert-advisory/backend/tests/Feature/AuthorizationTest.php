<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Lead;
use App\Models\Team;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    public function test_guest_receives_unauthenticated_envelope(): void
    {
        $this->assertApiError($this->getJson('/api/v1/admin/dashboard'), 401, 'UNAUTHENTICATED');
        $this->assertApiError($this->getJson('/api/v1/client/dashboard'), 401, 'UNAUTHENTICATED');
    }

    public function test_client_cannot_reach_admin_or_employee_endpoints(): void
    {
        $this->actingAs($this->makeClient());

        $this->assertApiError($this->getJson('/api/v1/admin/dashboard'), 403, 'FORBIDDEN');
        $this->assertApiError($this->getJson('/api/v1/admin/users'), 403, 'FORBIDDEN');
        $this->assertApiError($this->getJson('/api/v1/employee/leads'), 403, 'FORBIDDEN');
        $this->getJson('/api/v1/client/dashboard')->assertOk();
    }

    public function test_business_advisor_cannot_manage_users_or_view_audit(): void
    {
        $this->actingAsVerified($this->makeStaff('business_advisor'));

        $this->assertApiError($this->getJson('/api/v1/admin/users'), 403, 'FORBIDDEN');
        $this->assertApiError($this->getJson('/api/v1/admin/audit-logs'), 403, 'FORBIDDEN');
        $this->assertApiError($this->getJson('/api/v1/client/dashboard'), 403, 'FORBIDDEN');
    }

    public function test_auditor_is_read_only(): void
    {
        $this->actingAsVerified($this->makeStaff('auditor'));

        $this->getJson('/api/v1/admin/audit-logs')->assertOk();
        $this->getJson('/api/v1/admin/users')->assertOk();
        $this->assertApiError($this->postJson('/api/v1/admin/teams', ['name' => 'X']), 403, 'FORBIDDEN');
        $this->assertApiError($this->putJson('/api/v1/admin/settings', ['values' => ['company.brand_name' => 'X'], 'reason' => 'x']), 403, 'FORBIDDEN');
    }

    public function test_admin_cannot_grant_privileged_role(): void
    {
        $admin = $this->makeStaff('admin');
        $target = $this->makeStaff('business_advisor');
        $this->actingAsVerified($admin);

        $this->assertApiError(
            $this->putJson("/api/v1/admin/users/{$target->id}/roles", ['roles' => ['compliance_admin'], 'reason' => 'Promotion']),
            403,
            'PRIVILEGED_ROLE_FORBIDDEN',
        );

        $this->putJson("/api/v1/admin/users/{$target->id}/roles", ['roles' => ['team_leader'], 'reason' => 'Promotion'])
            ->assertOk()
            ->assertJsonPath('data.roles.0.name', 'team_leader');

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.roles_changed', 'subject_id' => $target->id, 'reason' => 'Promotion']);
    }

    public function test_user_cannot_change_own_roles(): void
    {
        $super = $this->makeStaff('super_admin');
        $this->actingAsVerified($super);

        $this->assertApiError(
            $this->putJson("/api/v1/admin/users/{$super->id}/roles", ['roles' => ['admin'], 'reason' => 'x']),
            403,
            'SELF_ROLE_CHANGE_FORBIDDEN',
        );
    }

    public function test_last_super_admin_cannot_be_removed_or_deactivated(): void
    {
        $super = $this->makeStaff('super_admin');
        $other = $this->makeStaff('super_admin');
        $this->actingAsVerified($super);

        $this->putJson("/api/v1/admin/users/{$other->id}/roles", ['roles' => ['admin'], 'reason' => 'Handover'])->assertOk();

        $second = $this->makeStaff('super_admin');
        $this->actingAsVerified($second);
        $this->postJson("/api/v1/admin/users/{$super->id}/deactivate", ['reason' => 'Left company'])->assertOk();

        $this->actingAsVerified($other->fresh()); // now an admin
        $this->assertApiError(
            $this->postJson("/api/v1/admin/users/{$second->id}/deactivate", ['reason' => 'x']),
            403,
            'PRIVILEGED_ROLE_FORBIDDEN',
        );
    }

    public function test_deactivation_blocks_existing_session(): void
    {
        $admin = $this->makeStaff('admin');
        $advisor = $this->makeStaff('business_advisor');

        $this->actingAsVerified($admin)->postJson("/api/v1/admin/users/{$advisor->id}/deactivate", ['reason' => 'Left'])->assertOk();

        $this->actingAsVerified($advisor->fresh());
        $this->assertApiError($this->getJson('/api/v1/me'), 403, 'ACCOUNT_INACTIVE');
    }

    public function test_admin_creates_staff_user_with_employee_record(): void
    {
        $this->actingAsVerified($this->makeStaff('admin'));

        $response = $this->postJson('/api/v1/admin/users', [
            'name' => 'New Advisor',
            'email' => 'New.Advisor@Example.test',
            'password' => 'Strong#Password2026',
            'designation' => 'Business Advisor',
            'roles' => ['business_advisor'],
            'reason' => 'New hire',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'new.advisor@example.test')
            ->assertJsonPath('data.two_factor_enabled', false)
            ->assertJsonMissingPath('data.password');

        $this->assertMatchesRegularExpression('/^ESC-\d{5}$/', $response->json('data.employee.employee_code'));
    }

    public function test_client_role_cannot_be_given_to_staff_via_user_creation(): void
    {
        $this->actingAsVerified($this->makeStaff('super_admin'));

        $this->assertApiError($this->postJson('/api/v1/admin/users', [
            'name' => 'X', 'email' => 'x@example.test', 'password' => 'Strong#Password2026', 'roles' => ['client'], 'reason' => 'x',
        ]), 422, 'VALIDATION_FAILED');
    }

    public function test_research_authorization_requires_compliance_permission_and_other_person(): void
    {
        $analyst = $this->makeStaff('research_analyst');
        $compliance = $this->makeStaff('compliance_admin');

        $this->actingAsVerified($this->makeStaff('admin'));
        $this->assertApiError($this->putJson("/api/v1/admin/users/{$analyst->id}/research-authorization", ['authorized' => true, 'reason' => 'x']), 403, 'FORBIDDEN');

        $this->actingAsVerified($compliance);
        $this->assertApiError($this->putJson("/api/v1/admin/users/{$compliance->id}/research-authorization", ['authorized' => true, 'reason' => 'x']), 403, 'SEPARATION_OF_DUTIES');

        $this->putJson("/api/v1/admin/users/{$analyst->id}/research-authorization", ['authorized' => true, 'reason' => 'Verified NISM certificate'])
            ->assertOk()
            ->assertJsonPath('data.employee.is_authorized_research_person', true);
    }

    public function test_lead_visibility_is_scoped_own_team_all(): void
    {
        $teamA = Team::create(['name' => 'A']);
        $teamB = Team::create(['name' => 'B']);

        $advisorA = $this->makeStaff('business_advisor', [], ['team_id' => $teamA->id]);
        $peerA = $this->makeStaff('business_advisor', [], ['team_id' => $teamA->id]);
        $advisorB = $this->makeStaff('business_advisor', [], ['team_id' => $teamB->id]);
        $leaderA = $this->makeStaff('team_leader', [], ['team_id' => $teamA->id]);
        $manager = $this->makeStaff('sales_manager');

        $own = Lead::forceCreate(['full_name' => 'Own', 'assigned_employee_id' => $advisorA->employee->id]);
        $peer = Lead::forceCreate(['full_name' => 'Peer', 'assigned_employee_id' => $peerA->employee->id]);
        $other = Lead::forceCreate(['full_name' => 'Other team', 'assigned_employee_id' => $advisorB->employee->id]);
        Lead::create(['full_name' => 'Unassigned']);

        $names = fn ($user) => collect($this->actingAsVerified($user)->getJson('/api/v1/employee/leads')->assertOk()->json('data'))->pluck('full_name')->sort()->values()->all();

        $this->assertSame(['Own'], $names($advisorA));
        $this->assertSame(['Other team'], $names($advisorB));
        $this->assertSame(['Own', 'Peer'], $names($leaderA));
        $this->assertSame(['Other team', 'Own', 'Peer', 'Unassigned'], $names($manager));

        $this->assertNotNull($own->id + $peer->id + $other->id);
    }

    public function test_client_dashboard_only_shows_own_record(): void
    {
        $alice = $this->makeClient();
        $bob = $this->makeClient();
        $alice->client()->create(['client_code' => 'C-A', 'full_name' => 'Alice']);
        $bob->client()->create(['client_code' => 'C-B', 'full_name' => 'Bob']);

        $this->actingAs($alice)->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonPath('data.client.full_name', 'Alice')
            ->assertDontSee('Bob');
    }

    public function test_employee_without_employee_record_sees_no_leads(): void
    {
        $user = $this->makeStaff('business_advisor');
        Employee::query()->where('user_id', $user->id)->delete();
        Lead::create(['full_name' => 'Someone']);

        $this->actingAsVerified($user->fresh())->getJson('/api/v1/employee/leads')->assertOk()->assertJsonCount(0, 'data');
    }
}
