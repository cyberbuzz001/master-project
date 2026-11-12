<?php

namespace Tests\Feature;

use App\Domain\Research\ResearchWorkflowService;
use App\Filament\Resources\LeadImportBatches\Pages\ManageLeadImportBatches;
use App\Filament\Resources\MessageTemplates\Pages\ManageMessageTemplates;
use App\Filament\Resources\ResearchReports\Pages\ListResearchReports;
use App\Filament\Resources\ScheduledActions\Pages\ManageScheduledActions;
use App\Filament\Resources\WhatsAppConversations\Pages\ManageWhatsAppConversations;
use App\Models\Lead;
use App\Models\LeadImportPreview;
use App\Models\Service;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Tests\TestCase;

class CrmProductionPanelTest extends TestCase
{
    public function test_import_wizard_previews_then_commits_without_default_consent(): void
    {
        Filament::setCurrentPanel('office');
        $this->actingAsVerified($this->makeStaff('super_admin'));
        $screen = Livewire::test(ManageLeadImportBatches::class)->assertOk()->mountAction('universalBulkImport')
            ->setActionData(['raw_text' => 'Test Prospect, 9876543210'])->goToNextWizardStep()->assertHasNoActionErrors();
        $this->assertSame(1, LeadImportPreview::count());
        $this->assertSame(0, Lead::count());
        $screen->setActionData(['consent_basis' => 'Supplied by the prospect for follow-up'])->callMountedAction()->assertHasNoActionErrors();
        $this->assertDatabaseHas('leads', ['mobile' => '+919876543210', 'communication_state' => 'CONSENT_PENDING']);
    }

    public function test_communications_screens_render_for_authorized_staff(): void
    {
        Filament::setCurrentPanel('office');
        $this->actingAsVerified($this->makeStaff('super_admin'));
        Livewire::test(ManageMessageTemplates::class)->assertOk()->mountAction('createDraft')->assertActionMounted('createDraft');
        Livewire::test(ManageScheduledActions::class)->assertOk();
        Livewire::test(ManageWhatsAppConversations::class)->assertOk();
    }

    public function test_authorized_staff_can_set_a_draft_research_audience(): void
    {
        Filament::setCurrentPanel('office');
        $staff = $this->makeStaff('super_admin');
        $this->actingAsVerified($staff);
        $service = Service::create(['code' => 'audience-test', 'name' => 'Research service', 'category' => 'research']);
        $report = app(ResearchWorkflowService::class)->createReport($staff, ['title' => 'Draft report', 'summary' => 'Pending review']);
        Livewire::test(ListResearchReports::class)
            ->callAction(TestAction::make('draft_audience')->table($report), data: ['eligible_service_ids' => [$service->id], 'eligible_trial_types' => ['equity']])
            ->assertHasNoActionErrors();
        $this->assertSame([$service->id], array_map('intval', $report->currentVersion->fresh()->eligible_service_ids));
        $this->assertDatabaseHas('audit_logs', ['action' => 'research.draft_audience_updated']);
    }
}
