<?php

namespace Tests\Feature;

use App\Domain\Research\ResearchAccessService;
use App\Models\Client;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use Illuminate\Support\Str;
use Tests\TestCase;

class ResearchAccessSecurityTest extends TestCase
{
    public function test_explicit_active_trial_audience_can_read_education_but_not_other_trial_types_or_expired_versions(): void
    {
        $user = $this->makeClient();
        $approver = $this->makeStaff('sales_manager');
        $lead = Lead::forceCreate(['full_name' => 'Trial client', 'mobile' => '+919876543210']);
        $client = Client::create(['user_id' => $user->id, 'client_code' => 'TRIAL-1', 'full_name' => 'Trial client', 'lead_id' => $lead->id]);
        $trial = FreeTrial::create(['lead_id' => $lead->id, 'client_id' => $client->id, 'trial_code' => 'DEMO-TEST', 'trial_type' => 'equity', 'status' => 'active', 'start_date' => today()->subDay(), 'end_date' => today()->addDay(), 'approved_by' => $approver->id, 'approved_at' => now()]);
        $report = ResearchReport::create(['uuid' => (string) Str::uuid(), 'report_code' => 'EDU-1', 'title' => 'Education', 'archive_status' => 'active', 'category' => ResearchReport::CATEGORY_EDUCATIONAL]);
        $version = ResearchVersion::create(['research_report_id' => $report->id, 'version' => 1, 'author_employee_id' => $this->makeStaff('research_analyst')->employee->id, 'title' => 'Education', 'status' => ResearchVersion::STATUS_PUBLISHED, 'published_at' => now(), 'eligible_trial_types' => ['equity']]);
        $access = app(ResearchAccessService::class);
        $this->assertNull($access->denialReason($client, $version));
        $trial->update(['trial_type' => 'commodity']);
        $this->assertNotNull($access->denialReason($client, $version));
        $trial->update(['trial_type' => 'equity', 'status' => 'cancelled']);
        $this->assertNotNull($access->denialReason($client, $version));
        $trial->update(['status' => 'active']);
        $version->valid_until = now()->subMinute();
        $this->assertNotNull($access->denialReason($client, $version));
    }

    public function test_historical_distribution_never_grants_an_unmapped_service(): void
    {
        $user = $this->makeClient();
        $client = Client::create(['user_id' => $user->id, 'client_code' => 'NO-ACCESS', 'full_name' => 'No entitlement']);
        $report = ResearchReport::create(['uuid' => (string) Str::uuid(), 'report_code' => 'LOCKED-1', 'title' => 'Private', 'archive_status' => 'active']);
        $version = ResearchVersion::create(['research_report_id' => $report->id, 'version' => 1, 'author_employee_id' => $this->makeStaff('research_analyst')->employee->id, 'title' => 'Private', 'status' => ResearchVersion::STATUS_PUBLISHED, 'published_at' => now()]);
        $this->assertNotNull(app(ResearchAccessService::class)->denialReason($client, $version));
    }
}
