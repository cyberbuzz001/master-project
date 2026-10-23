<?php

namespace App\Domain\Crm;

use App\Domain\Communications\WhatsAppService;
use App\Models\AutomationWorkflow;
use App\Models\Lead;
use App\Models\ScheduledAction;
use App\Models\SuppressionRecord;
use App\Models\WorkflowRun;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class AutomationWorkflowEngine
{
    public function __construct(
        protected WhatsAppService $whatsAppService,
        protected LeadScoringEngine $scoringEngine
    ) {}

    /**
     * Start a workflow for a specific lead.
     */
    public function triggerWorkflow(Lead $lead, string $workflowCode): ?WorkflowRun
    {
        // 1. Check suppression & DND
        if (
            $lead->communication_state === 'OPTED_OUT' ||
            $lead->communication_state === 'DO_NOT_CONTACT' ||
            $lead->status === 'DND' ||
            SuppressionRecord::isSuppressed($lead->mobile)
        ) {
            Log::info("WorkflowEngine: Lead {$lead->id} is suppressed or opted out. Workflow '{$workflowCode}' aborted.");
            return null;
        }

        $workflow = AutomationWorkflow::firstOrCreate(
            ['code' => $workflowCode],
            [
                'name' => ucwords(str_replace(['WORKFLOW_', '_'], ['', ' '], $workflowCode)),
                'trigger_event' => 'SYSTEM',
                'is_active' => true,
            ]
        );

        $run = WorkflowRun::create([
            'workflow_id' => $workflow->id,
            'lead_id' => $lead->id,
            'status' => 'running',
            'started_at' => now(),
            'step_history_json' => [
                'workflow_code' => $workflowCode,
                'lead_mobile' => $lead->mobile,
                'communication_state' => $lead->communication_state,
            ],
        ]);

        match ($workflowCode) {
            'WORKFLOW_A_NEW_IMPORT' => $this->handleWorkflowNewImport($lead, $run),
            'WORKFLOW_B_ELIGIBLE_INTRO' => $this->handleWorkflowEligibleIntro($lead, $run),
            'WORKFLOW_C_DEMO_NURTURING' => $this->handleWorkflowDemoNurturing($lead, $run),
            'WORKFLOW_D_APPOINTMENT' => $this->handleWorkflowAppointment($lead, $run),
            'WORKFLOW_G_OPTOUT' => $this->handleWorkflowOptOut($lead, $run),
            default => $this->handleDefaultWorkflow($lead, $run, $workflowCode),
        };

        return $run;
    }

    /**
     * Workflow A: Newly Imported Lead.
     * Deduplicate, score, assign consent queue or eligible outreach.
     */
    protected function handleWorkflowNewImport(Lead $lead, WorkflowRun $run): void
    {
        // Recalculate score
        $scoreResult = $this->scoringEngine->scoreLead($lead);

        // If statutory consent verified -> Eligible for WhatsApp intro
        if (in_array($lead->communication_state, ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])) {
            $this->scheduleAction(
                lead: $lead,
                run: $run,
                actionType: 'send_intro_whatsapp',
                payload: ['template_name' => 'expert_stocks_intro_v1'],
                delayMinutes: 5
            );
        } else {
            // Place into phone outreach or opt-in queue
            $lead->update(['communication_state' => 'CONSENT_PENDING']);
        }

        $run->update([
            'status' => 'completed',
            'completed_at' => now(),
            'step_history_json' => array_merge($run->step_history_json ?? [], ['score' => $scoreResult['score']]),
        ]);
    }

    /**
     * Workflow B: Eligible Lead with Verified Permission.
     */
    protected function handleWorkflowEligibleIntro(Lead $lead, WorkflowRun $run): void
    {
        if (!in_array($lead->communication_state, ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])) {
            $run->update([
                'status' => 'cancelled',
                'stop_reason' => 'Consent not verified for WhatsApp communication',
            ]);
            return;
        }

        $this->scheduleAction(
            lead: $lead,
            run: $run,
            actionType: 'send_intro_whatsapp',
            payload: ['template_name' => 'expert_stocks_intro_v1'],
            delayMinutes: 1
        );
    }

    /**
     * Workflow C: Demo Conversion Nurturing.
     */
    protected function handleWorkflowDemoNurturing(Lead $lead, WorkflowRun $run): void
    {
        // Schedule day-1 follow up reminder
        $this->scheduleAction(
            lead: $lead,
            run: $run,
            actionType: 'send_demo_reminder',
            payload: ['day' => 1],
            delayMinutes: 1440 // 24 hours
        );
    }

    /**
     * Workflow D: Appointment Follow-up.
     */
    protected function handleWorkflowAppointment(Lead $lead, WorkflowRun $run): void
    {
        // Schedule reminder 2 hours prior
        $this->scheduleAction(
            lead: $lead,
            run: $run,
            actionType: 'send_appointment_reminder',
            payload: ['hours_before' => 2],
            delayMinutes: 60
        );
    }

    /**
     * Workflow G: Immediate Opt-Out & Suppression Cancellation.
     */
    public function handleWorkflowOptOut(Lead $lead, ?WorkflowRun $run = null): void
    {
        // Cancel all pending actions for this lead
        ScheduledAction::where('lead_id', $lead->id)
            ->where('status', 'pending')
            ->update([
                'status' => 'cancelled',
                'execution_error' => 'Cancelled due to customer opt-out request.',
            ]);

        // Cancel all active workflow runs
        WorkflowRun::where('lead_id', $lead->id)
            ->where('status', 'running')
            ->update([
                'status' => 'stopped_opt_out',
                'stop_reason' => 'Customer opted out.',
                'completed_at' => now(),
            ]);

        if ($run) {
            $run->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);
        }
    }

    /**
     * Generic/Default Workflow.
     */
    protected function handleDefaultWorkflow(Lead $lead, WorkflowRun $run, string $code): void
    {
        $run->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Schedule a future action respecting Quiet Hours (9 AM - 8 PM IST).
     */
    public function scheduleAction(Lead $lead, ?WorkflowRun $run, string $actionType, array $payload, int $delayMinutes = 0): ScheduledAction
    {
        $targetTime = Carbon::now('Asia/Kolkata')->addMinutes($delayMinutes);

        // Adjust for Quiet Hours (Meta & TRAI: 9 AM to 8 PM IST)
        $hour = (int) $targetTime->format('H');
        if ($hour < 9) {
            // Before 9 AM -> push to 9:15 AM today
            $targetTime = $targetTime->copy()->setTime(9, 15, 0);
        } elseif ($hour >= 20) {
            // After 8 PM -> push to 9:15 AM tomorrow
            $targetTime = $targetTime->copy()->addDay()->setTime(9, 15, 0);
        }

        return ScheduledAction::create([
            'workflow_run_id' => $run?->id,
            'lead_id' => $lead->id,
            'action_type' => $actionType,
            'action_payload_json' => $payload,
            'scheduled_for' => $targetTime->setTimezone('UTC'),
            'status' => 'pending',
        ]);
    }

    /**
     * Process all due scheduled actions (called via cron / artisan console).
     */
    public function processPendingActions(int $limit = 50): int
    {
        $now = Carbon::now('Asia/Kolkata');
        $hour = (int) $now->format('H');

        // Do not dispatch outbound automated marketing during quiet hours
        if ($hour < 9 || $hour >= 20) {
            Log::info("WorkflowEngine: Currently in Quiet Hours ({$hour}:00 IST). Postponing action executions.");
            return 0;
        }

        $dueActions = ScheduledAction::with(['lead', 'workflowRun'])
            ->where('status', 'pending')
            ->where('scheduled_for', '<=', now())
            ->take($limit)
            ->get();

        $processedCount = 0;

        foreach ($dueActions as $action) {
            $lead = $action->lead;

            // Check if lead has been suppressed or AI is paused
            if (!$lead || $lead->is_ai_paused || SuppressionRecord::isSuppressed($lead->mobile)) {
                $action->update([
                    'status' => 'cancelled',
                    'execution_error' => 'Action cancelled because lead is suppressed or AI is paused by human takeover.',
                ]);
                continue;
            }

            try {
                $this->executeAction($action);
                $action->update([
                    'status' => 'executed',
                    'executed_at' => now(),
                ]);
                $processedCount++;
            } catch (\Throwable $e) {
                Log::error("WorkflowEngine Action Failed: {$e->getMessage()}", ['action_id' => $action->id]);
                $action->update([
                    'status' => 'failed',
                    'execution_error' => $e->getMessage(),
                ]);
            }
        }

        return $processedCount;
    }

    /**
     * Execute an individual scheduled action.
     */
    protected function executeAction(ScheduledAction $action): void
    {
        $lead = $action->lead;
        $payload = $action->action_payload ?? [];

        switch ($action->action_type) {
            case 'send_intro_whatsapp':
                $text = "Hello {$lead->full_name}, thank you for connecting with Expert Stocks Consultancy. We provide research-backed equity & derivative advisory. Would you like to evaluate our 2-day Free Demo, view service plans, or book an analyst call?";
                $this->whatsAppService->sendMessage($lead->mobile, $text);
                break;

            case 'send_demo_reminder':
                $text = "Hello {$lead->full_name}, this is your reminder from Expert Stocks Consultancy regarding your active Free Demo research recommendations.";
                $this->whatsAppService->sendMessage($lead->mobile, $text);
                break;

            case 'send_appointment_reminder':
                $text = "Hello {$lead->full_name}, your consultation session with our research desk analyst is scheduled shortly. Please keep your portfolio questions handy.";
                $this->whatsAppService->sendMessage($lead->mobile, $text);
                break;

            default:
                Log::info("WorkflowEngine: Unhandled action type '{$action->action_type}' for action #{$action->id}");
                break;
        }
    }
}
