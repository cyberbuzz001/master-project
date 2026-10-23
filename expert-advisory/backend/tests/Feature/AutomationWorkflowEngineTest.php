<?php

namespace Tests\Feature;

use App\Domain\Crm\AutomationWorkflowEngine;
use App\Models\Lead;
use App\Models\ScheduledAction;
use App\Models\SuppressionRecord;
use App\Models\WorkflowRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutomationWorkflowEngineTest extends TestCase
{
    use RefreshDatabase;

    private AutomationWorkflowEngine $workflowEngine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->workflowEngine = app(AutomationWorkflowEngine::class);
    }

    public function test_workflow_new_import_schedules_intro_when_consent_verified(): void
    {
        $lead = Lead::create([
            'full_name' => 'Salim Babulal Sayyad',
            'mobile' => '+919226427240',
            'communication_state' => 'CONSENT_VERIFIED',
            'status' => 'NEW',
        ]);

        $run = $this->workflowEngine->triggerWorkflow($lead, 'WORKFLOW_A_NEW_IMPORT');

        $this->assertNotNull($run);
        $this->assertEquals('completed', $run->status);

        // Should have scheduled a pending WhatsApp intro action
        $scheduled = ScheduledAction::where('lead_id', $lead->id)->first();
        $this->assertNotNull($scheduled);
        $this->assertEquals('send_intro_whatsapp', $scheduled->action_type);
        $this->assertEquals('pending', $scheduled->status);
    }

    public function test_workflow_aborts_for_suppressed_lead(): void
    {
        $lead = Lead::create([
            'full_name' => 'Vishalbhai Chudasma',
            'mobile' => '+918849077204',
            'communication_state' => 'OPTED_OUT',
            'status' => 'DND',
        ]);

        $run = $this->workflowEngine->triggerWorkflow($lead, 'WORKFLOW_A_NEW_IMPORT');

        $this->assertNull($run);
        $this->assertEquals(0, ScheduledAction::where('lead_id', $lead->id)->count());
    }

    public function test_opt_out_cancels_all_pending_scheduled_actions(): void
    {
        $lead = Lead::create([
            'full_name' => 'Mishab Thekka',
            'mobile' => '+918590800550',
            'communication_state' => 'CONSENT_VERIFIED',
            'status' => 'NEW',
        ]);

        $run = $this->workflowEngine->triggerWorkflow($lead, 'WORKFLOW_A_NEW_IMPORT');
        $this->assertEquals(1, ScheduledAction::where('lead_id', $lead->id)->where('status', 'pending')->count());

        // Trigger opt-out
        $this->workflowEngine->handleWorkflowOptOut($lead);

        // Pending action must be marked cancelled
        $cancelledAction = ScheduledAction::where('lead_id', $lead->id)->first();
        $this->assertEquals('cancelled', $cancelledAction->status);
    }
}
