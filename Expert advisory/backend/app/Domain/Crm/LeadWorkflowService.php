<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Shared\ApiException;
use App\Models\CallLog;
use App\Models\Followup;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadStatusHistory;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Every change to a lead's lifecycle goes through here so status history, the timeline and the
 * audit log are always written together.
 */
final class LeadWorkflowService
{
    /**
     * Status suggested by each call outcome. `null` keeps the current status.
     */
    private const CALL_OUTCOME_STATUS = [
        'no_answer' => 'NPC',
        'busy' => 'NPC',
        'switched_off' => 'NPC',
        'callback_requested' => 'CALL_BACK',
        'not_interested' => 'NOT_INTERESTED',
        'wrong_number' => 'INVALID',
        'connected' => null,
    ];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ConsentRecorder $consents,
    ) {}

    public function changeStatus(User $actor, Lead $lead, string $to, string $reason): Lead
    {
        $this->assertCanWork($actor, $lead);

        $from = LeadStatus::from($lead->status);
        $target = LeadStatus::tryFrom($to) ?? throw ApiException::invalidTransition($from->value, $to);

        if (! in_array($target->value, $from->manualTransitions(), true)) {
            throw ApiException::invalidTransition($from->value, $target->value);
        }

        if ($from === LeadStatus::Dnd && ! $actor->can('compliance.review')) {
            throw ApiException::forbidden('Only compliance can lift Do Not Disturb, after fresh consent is recorded.', 'DND_LIFT_FORBIDDEN');
        }

        return DB::transaction(function () use ($actor, $lead, $from, $target, $reason): Lead {
            $this->applyStatus($lead, $from, $target, $actor, $reason);

            if ($target === LeadStatus::Dnd) {
                $this->applyDoNotDisturb($lead, $actor);
            }

            return $lead;
        });
    }

    /**
     * System-only transitions (verified payment → PAID → CONVERTED). Never exposed to UI actions.
     */
    public function applySystemStatus(Lead $lead, LeadStatus $target, string $reason): Lead
    {
        $from = LeadStatus::from($lead->status);

        if (! in_array($target->value, $from->systemTransitions(), true)) {
            throw ApiException::invalidTransition($from->value, $target->value);
        }

        return DB::transaction(fn () => tap($lead, fn () => $this->applyStatus($lead, $from, $target, null, $reason)));
    }

    /**
     * @param  array{outcome: string, direction?: string, duration_seconds?: ?int, notes?: ?string, called_at?: mixed, followup_at?: mixed, followup_channel?: ?string}  $data
     */
    public function logCall(User $actor, Lead $lead, array $data): CallLog
    {
        $this->assertCanWork($actor, $lead);

        $outcome = $data['outcome'];
        if (! array_key_exists($outcome, CallLog::OUTCOMES)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Unknown call outcome.', ['outcome' => ['Unknown call outcome.']]);
        }

        if ($lead->status === LeadStatus::Dnd->value) {
            throw ApiException::forbidden('This lead is marked Do Not Disturb and must not be called.', 'LEAD_DND');
        }

        $followupAt = isset($data['followup_at']) ? Carbon::parse($data['followup_at']) : null;
        if ($outcome === 'callback_requested' && $followupAt === null) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Schedule the call back time.', ['followup_at' => ['Schedule the call back time.']]);
        }
        if ($followupAt !== null && $followupAt->isPast()) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Follow-up time must be in the future.', ['followup_at' => ['Follow-up time must be in the future.']]);
        }

        return DB::transaction(function () use ($actor, $lead, $data, $outcome, $followupAt): CallLog {
            $calledAt = isset($data['called_at']) ? Carbon::parse($data['called_at']) : now();

            $call = CallLog::create([
                'lead_id' => $lead->id,
                'employee_id' => $actor->employee?->id,
                'direction' => $data['direction'] ?? 'outbound',
                'outcome' => $outcome,
                'duration_seconds' => $data['duration_seconds'] ?? null,
                'notes' => $data['notes'] ?? null,
                'called_at' => $calledAt,
                'is_demo' => (bool) $lead->is_demo,
            ]);

            $lead->forceFill(['last_contacted_at' => $calledAt, 'call_outcome' => $outcome, 'escalated_at' => null])->save();

            LeadActivity::create([
                'lead_id' => $lead->id,
                'type' => 'call',
                'actor_user_id' => $actor->id,
                'summary' => 'Call: '.CallLog::OUTCOMES[$outcome],
                'details' => ['call_log_id' => $call->id, 'notes' => $data['notes'] ?? null, 'duration_seconds' => $data['duration_seconds'] ?? null],
                'occurred_at' => $calledAt,
            ]);

            $from = LeadStatus::from($lead->status);
            $suggested = self::CALL_OUTCOME_STATUS[$outcome] ?? ($followupAt !== null ? 'FOLLOW_UP' : null);
            if ($suggested !== null && in_array($suggested, $from->manualTransitions(), true)) {
                $this->applyStatus($lead, $from, LeadStatus::from($suggested), $actor, 'Call outcome: '.CallLog::OUTCOMES[$outcome]);
            }

            if ($followupAt !== null) {
                $this->createFollowup($actor, $lead, $followupAt, $data['followup_channel'] ?? 'call', $data['notes'] ?? null);
            }

            return $call;
        });
    }

    public function scheduleFollowup(User $actor, Lead $lead, CarbonInterface $dueAt, string $channel, ?string $notes): Followup
    {
        $this->assertCanWork($actor, $lead);

        if ($dueAt->isPast()) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Follow-up time must be in the future.', ['due_at' => ['Follow-up time must be in the future.']]);
        }

        if (! array_key_exists($channel, Followup::CHANNELS)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Unknown channel.', ['channel' => ['Unknown channel.']]);
        }

        if ($lead->status === LeadStatus::Dnd->value) {
            throw ApiException::forbidden('This lead is marked Do Not Disturb.', 'LEAD_DND');
        }

        return DB::transaction(fn () => $this->createFollowup($actor, $lead, $dueAt, $channel, $notes));
    }

    public function completeFollowup(User $actor, Followup $followup, string $outcome): Followup
    {
        $this->assertCanWork($actor, $followup->lead);

        if (! in_array($followup->status, [Followup::PENDING, Followup::MISSED], true)) {
            throw ApiException::invalidTransition($followup->status, Followup::DONE);
        }

        return DB::transaction(function () use ($actor, $followup, $outcome): Followup {
            $followup->forceFill(['status' => Followup::DONE, 'outcome' => $outcome, 'completed_by' => $actor->id, 'completed_at' => now()])->save();

            LeadActivity::create([
                'lead_id' => $followup->lead_id,
                'type' => 'followup_completed',
                'actor_user_id' => $actor->id,
                'summary' => 'Follow-up completed: '.$outcome,
                'details' => ['followup_id' => $followup->id],
                'occurred_at' => now(),
            ]);

            $this->syncNextFollowup($followup->lead);

            return $followup;
        });
    }

    public function cancelFollowup(User $actor, Followup $followup, string $reason): Followup
    {
        $this->assertCanWork($actor, $followup->lead);

        if ($followup->status !== Followup::PENDING) {
            throw ApiException::invalidTransition($followup->status, Followup::CANCELLED);
        }

        return DB::transaction(function () use ($actor, $followup, $reason): Followup {
            $followup->forceFill(['status' => Followup::CANCELLED, 'outcome' => $reason, 'completed_by' => $actor->id, 'completed_at' => now()])->save();
            $this->syncNextFollowup($followup->lead);

            return $followup;
        });
    }

    public function addNote(User $actor, Lead $lead, string $note): LeadActivity
    {
        $this->assertCanWork($actor, $lead);

        LeadEscalationService::clear($lead);

        return LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'note',
            'actor_user_id' => $actor->id,
            'summary' => mb_substr($note, 0, 500),
            'details' => mb_strlen($note) > 500 ? ['full_text' => $note] : null,
            'occurred_at' => now(),
        ]);
    }

    public function clearDuplicateFlag(User $actor, Lead $lead, string $reason): Lead
    {
        $this->assertCanWork($actor, $lead);

        $old = $lead->duplicate_of_lead_id;
        $lead->forceFill(['duplicate_of_lead_id' => null])->save();

        LeadActivity::create([
            'lead_id' => $lead->id, 'type' => 'duplicate_flag', 'actor_user_id' => $actor->id,
            'summary' => 'Marked as not a duplicate', 'details' => ['previous_duplicate_of' => $old, 'reason' => $reason], 'occurred_at' => now(),
        ]);
        $this->audit->record('lead.duplicate_cleared', $lead, ['duplicate_of_lead_id' => $old], ['duplicate_of_lead_id' => null], $reason);

        return $lead;
    }

    public function assertCanWork(User $actor, Lead $lead): void
    {
        if (! $actor->can('leads.update') || ! Lead::query()->visibleTo($actor)->whereKey($lead->id)->exists()) {
            throw ApiException::forbidden('You cannot work on this lead.');
        }
    }

    private function applyStatus(Lead $lead, LeadStatus $from, LeadStatus $to, ?User $actor, string $reason): void
    {
        $lead->forceFill(['status' => $to->value, 'dnd_at' => $to === LeadStatus::Dnd ? now() : $lead->dnd_at, 'escalated_at' => null])->save();

        LeadStatusHistory::create([
            'lead_id' => $lead->id,
            'from_status' => $from->value,
            'to_status' => $to->value,
            'changed_by' => $actor?->id,
            'reason' => $reason,
        ]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'status_changed',
            'actor_user_id' => $actor?->id,
            'summary' => $from->getLabel().' → '.$to->getLabel(),
            'details' => ['from' => $from->value, 'to' => $to->value, 'reason' => $reason],
            'occurred_at' => now(),
        ]);

        $this->audit->record('lead.status_changed', $lead, ['status' => $from->value], ['status' => $to->value], $reason, $actor, $actor ? 'user' : 'system');
    }

    /**
     * DND withdraws contact consents and cancels pending follow-ups.
     */
    private function applyDoNotDisturb(Lead $lead, User $actor): void
    {
        foreach (['calls', 'whatsapp', 'marketing_email'] as $purpose) {
            $this->consents->record('lead', $lead->id, $purpose, false, 'staff_recorded', 'Contact preference recorded by staff: do not disturb.', isDemo: (bool) $lead->is_demo);
        }

        Followup::query()->where('lead_id', $lead->id)->where('status', Followup::PENDING)
            ->update(['status' => Followup::CANCELLED, 'outcome' => 'Lead marked Do Not Disturb', 'completed_by' => $actor->id, 'completed_at' => now()]);

        $lead->forceFill(['next_followup_at' => null])->save();
    }

    private function createFollowup(User $actor, Lead $lead, CarbonInterface $dueAt, string $channel, ?string $notes): Followup
    {
        $followup = Followup::create([
            'lead_id' => $lead->id,
            'employee_id' => $lead->assigned_employee_id ?? $actor->employee?->id,
            'channel' => $channel,
            'due_at' => $dueAt,
            'notes' => $notes,
            'created_by' => $actor->id,
            'is_demo' => (bool) $lead->is_demo,
        ]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'followup_scheduled',
            'actor_user_id' => $actor->id,
            'summary' => 'Follow-up ('.Followup::CHANNELS[$channel].') scheduled for '.$dueAt->timezone(config('platform.timezone_display'))->format('d M Y, h:i A'),
            'details' => ['followup_id' => $followup->id],
            'occurred_at' => now(),
        ]);

        $this->syncNextFollowup($lead);
        LeadEscalationService::clear($lead);

        return $followup;
    }

    private function syncNextFollowup(Lead $lead): void
    {
        $next = Followup::query()->where('lead_id', $lead->id)->where('status', Followup::PENDING)->min('due_at');
        $lead->forceFill(['next_followup_at' => $next])->save();
    }
}
