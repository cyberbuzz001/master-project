<?php

namespace App\Domain\Crm;

use App\Domain\Communications\WhatsAppService;
use App\Domain\Research\ResearchAccessService;
use App\Models\Appointment;
use App\Models\AutomationWorkflow;
use App\Models\Client;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\MessageTemplate;
use App\Models\ResearchDistribution;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use App\Models\ScheduledAction;
use App\Models\SuppressionRecord;
use App\Models\WorkflowRun;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

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
        if (! in_array($workflowCode, ['WORKFLOW_A_NEW_IMPORT', 'WORKFLOW_B_ELIGIBLE_INTRO', 'WORKFLOW_C_DEMO_NURTURING', 'WORKFLOW_D_APPOINTMENT', 'WORKFLOW_G_OPTOUT'], true)) {
            throw new InvalidArgumentException('Unsupported workflow code.');
        }
        if ($workflowCode === 'WORKFLOW_G_OPTOUT') {
            $this->handleWorkflowOptOut($lead);

            return null;
        }
        if ($lead->is_ai_paused) {
            return null;
        }
        // 1. Check suppression & DND
        if (
            $lead->communication_state === 'OPTED_OUT' ||
            $lead->communication_state === 'DO_NOT_CONTACT' ||
            $lead->status === 'DND' ||
            SuppressionRecord::isSuppressed($lead->mobile, $lead->email, 'whatsapp')
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

        if (! $workflow->is_active) {
            return null;
        }

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
        if (! in_array($lead->communication_state, ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])) {
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
        // TrialLifecycleService schedules activation and the first-session review once.
        app(TrialLifecycleService::class)->activateApprovedTrials();
        $run->update(['status' => 'completed', 'completed_at' => now()]);
    }

    /**
     * Workflow D: Appointment Follow-up.
     */
    protected function handleWorkflowAppointment(Lead $lead, WorkflowRun $run): void
    {
        $appointment = Appointment::where('lead_id', $lead->id)->where('status', 'confirmed')->where('scheduled_start', '>', now())->orderBy('scheduled_start')->first();
        if (! $appointment) {
            $run->update(['status' => 'cancelled', 'stop_reason' => 'No confirmed future appointment.']);

            return;
        }
        $delay = max(0, (int) now()->diffInMinutes($appointment->scheduled_start->copy()->subHours(2), false));
        $this->scheduleAction($lead, $run, 'send_appointment_reminder', [
            'appointment_id' => $appointment->id, 'parameters' => [$lead->full_name, $appointment->scheduled_start->timezone('Asia/Kolkata')->format('d M Y H:i')],
        ], $delay);
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

        // Apply configured business outreach hours.
        $hour = (int) $targetTime->format('H');
        if ($hour < (int) config('services.whatsapp.outreach_start_hour', 9)) {
            // Before 9 AM -> push to 9:15 AM today
            $targetTime = $targetTime->copy()->setTime((int) config('services.whatsapp.outreach_start_hour', 9), 15, 0);
        } elseif ($hour >= (int) config('services.whatsapp.outreach_end_hour', 20)) {
            // After 8 PM -> push to 9:15 AM tomorrow
            $targetTime = $targetTime->copy()->addDay()->setTime((int) config('services.whatsapp.outreach_start_hour', 9), 15, 0);
        }

        ksort($payload);
        $key = hash('sha256', json_encode([$lead->id, $run?->workflow_id, $actionType, $payload], JSON_THROW_ON_ERROR));

        return ScheduledAction::firstOrCreate(['idempotency_key' => $key], [
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
        ScheduledAction::where('status', 'processing')->where('claimed_at', '<', now()->subMinutes(15))
            ->update(['status' => 'review_required', 'execution_error' => 'Worker stopped. Reconcile provider delivery before retry.']);
        if (! config('services.whatsapp.automation_enabled', false) || $this->whatsAppService->isQuietHoursNow()) {
            return 0;
        }
        $ids = ScheduledAction::where('status', 'pending')->where('scheduled_for', '<=', now())->orderBy('id')->limit(max(1, min($limit, 200)))->pluck('id');
        $processed = 0;
        $started = microtime(true);
        foreach ($ids as $id) {
            if (microtime(true) - $started > 45) {
                break;
            }
            $claimed = ScheduledAction::whereKey($id)->where('status', 'pending')->update(['status' => 'processing', 'claimed_at' => now(), 'attempts' => DB::raw('attempts + 1')]);
            if (! $claimed) {
                continue;
            }
            $action = ScheduledAction::with(['lead', 'workflowRun.workflow'])->findOrFail($id);
            $lead = $action->lead;
            $payload = $action->action_payload_json ?? [];
            $trial = isset($payload['trial_id']) ? FreeTrial::find($payload['trial_id']) : null;
            $appointment = isset($payload['appointment_id']) ? Appointment::find($payload['appointment_id']) : null;
            if (! $lead || $lead->is_ai_paused || in_array($lead->communication_state, ['OPTED_OUT', 'DO_NOT_CONTACT', 'CHANNEL_RESTRICTED'], true)
                || SuppressionRecord::isSuppressed($lead->mobile, $lead->email, 'whatsapp')
                || ($action->workflowRun && ! $action->workflowRun->workflow?->is_active)
                || (isset($payload['trial_id']) && (! $trial || $trial->lead_id !== $lead->id || $trial->status !== 'active' || $trial->start_date->toDateString() > Carbon::now('Asia/Kolkata')->toDateString() || $trial->end_date->toDateString() < Carbon::now('Asia/Kolkata')->toDateString() || in_array($lead->status, ['PAID', 'CONVERTED'], true)))
                || (isset($payload['appointment_id']) && (! $appointment || $appointment->lead_id !== $lead->id || $appointment->status !== 'confirmed' || $appointment->scheduled_start->isPast()))) {
                $action->update(['status' => 'cancelled', 'execution_error' => 'Current consent, workflow, ownership or entitlement does not permit delivery.']);

                continue;
            }
            try {
                $result = $this->executeAction($action);
                if ($result['success']) {
                    $action->update(['status' => 'executed', 'executed_at' => now(), 'provider_message_id' => $result['provider_message_id'], 'execution_error' => null]);
                    $processed++;
                } elseif ($result['status'] === 'rate_limited' && $action->attempts < 5) {
                    $action->update(['status' => 'pending', 'scheduled_for' => now()->addSeconds(max($result['retry_after'] ?? 60, 2 ** $action->attempts * 30) + random_int(0, 30)), 'execution_error' => $result['error']]);
                } elseif ($result['status'] === 'quiet_hours_deferred') {
                    $action->update(['status' => 'pending', 'scheduled_for' => now()->addHour(), 'execution_error' => $result['error']]);
                } else {
                    $action->update(['status' => $result['status'] === 'review_required' ? 'review_required' : 'failed', 'execution_error' => $result['error']]);
                }
            } catch (InvalidArgumentException $exception) {
                $action->update(['status' => 'failed', 'execution_error' => $exception->getMessage()]);
            } catch (\Throwable $exception) {
                $action->update(['status' => 'review_required', 'execution_error' => 'Processing failed. Reconcile any provider side effects before retry.']);
                report($exception);
            }
        }

        return $processed;
    }

    protected function executeAction(ScheduledAction $action): array
    {
        $payload = $action->action_payload_json ?? [];
        if ($action->action_type === 'send_research_notification') {
            $version = ResearchVersion::find($payload['research_version_id'] ?? null);
            $client = Client::find($payload['client_id'] ?? null);
            $template = $version ? MessageTemplate::where('key', $version->whatsapp_template_key)->first() : null;
            $purpose = $version?->report?->category === ResearchReport::CATEGORY_EDUCATIONAL ? 'educational_content' : 'research_communication';
            if (! $version || ! $client || $client->lead_id !== $action->lead_id || ! $template || $template->purpose !== $purpose
                || array_diff($template->variables ?? [], ['name', 'report_title', 'portal_link'])
                || app(ResearchAccessService::class)->denialReason($client, $version) !== null
                || ! ResearchDistribution::where('client_id', $client->id)->where('research_version_id', $version->id)->where('delivery_status', ResearchDistribution::STATUS_DELIVERED)->exists()) {
                return ['success' => false, 'status' => 'failed', 'error' => 'Current research entitlement or template mapping does not permit delivery.'];
            }
            $data = ['name' => $client->full_name, 'report_title' => $version->title, 'portal_link' => rtrim(config('platform.frontend_url'), '/').'/portal/research'];
            $result = $this->whatsAppService->sendForRecipient($template, 'client', $client->id, array_map(fn ($variable) => (string) $data[$variable], $template->variables ?? []));
            MessageLog::create(['channel' => 'whatsapp', 'recipient_type' => 'client', 'recipient_id' => $client->id, 'recipient_phone' => $client->mobile, 'template_id' => $template->id, 'rendered_subject' => $version->title, 'rendered_body' => $data['portal_link'], 'consent_verified' => ! in_array($result['status'], ['consent_refused', 'suppressed'], true), 'status' => $result['status'], 'provider_message_id' => $result['provider_message_id'] ?? null, 'sent_at' => $result['success'] ? now() : null, 'error_message' => $result['error'] ?? null]);

            return $result;
        }
        $template = match ($action->action_type) {
            'send_intro_whatsapp' => 'expert_stocks_intro_v1',
            'send_demo_reminder' => 'esc_trial_day1_review_v1',
            'send_trial_activation' => 'esc_trial_activation_v1',
            'send_trial_review' => 'esc_trial_day1_review_v1',
            'send_appointment_reminder' => 'esc_appointment_reminder_v1',
            default => throw new InvalidArgumentException('Unsupported scheduled action type.'),
        };

        return $this->whatsAppService->sendTemplate($action->lead->mobile, $payload['template_name'] ?? $template, $payload['parameters'] ?? [$action->lead->full_name], $action->lead);
    }
}
