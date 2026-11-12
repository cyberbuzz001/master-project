<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Models\Client;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\ScheduledAction;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TrialLifecycleService
{
    public function __construct(private AutomationWorkflowEngine $engine, private AuditLogger $audit) {}

    public function defaultDates(string $type = 'index_options'): array
    {
        $first = $this->firstSession(Carbon::now('Asia/Kolkata')->toDateString(), $type);

        return ['start_date' => $first->toDateString(), 'end_date' => $this->nextTradingDay($first->copy()->addDay())->toDateString()];
    }

    private function nextTradingDay(Carbon $day): Carbon
    {
        for ($i = 0; $i < 366; $i++) {
            if (! $day->isWeekend() && ! in_array($day->toDateString(), config('crm.trading_holidays', []), true)) {
                return $day;
            }
            $day->addDay();
        }
        throw ValidationException::withMessages(['start_date' => 'No trading session is available in the configured calendar.']);
    }

    private function firstSession(string $start, string $type): Carbon
    {
        $now = Carbon::now('Asia/Kolkata');
        $day = Carbon::parse($start, 'Asia/Kolkata')->startOfDay();
        if ($day->lt($now->copy()->startOfDay())) {
            $day = $now->copy()->startOfDay();
        }
        if ($day->isSameDay($now) && $now->format('H:i') >= config('crm.sessions.'.$type.'.close', '15:30')) {
            $day->addDay();
        }

        return $this->nextTradingDay($day)->setTimeFromTimeString(config('crm.sessions.'.$type.'.open', '09:15'));
    }

    public function request(User $actor, array $data): FreeTrial
    {
        $lead = Lead::findOrFail($data['lead_id'] ?? null);
        Gate::forUser($actor)->authorize('update', $lead);

        return $this->createRequest($lead, $data, $actor);
    }

    public function requestFromInbound(Lead $lead): FreeTrial
    {
        return $this->createRequest($lead, ['trial_type' => 'index_options', ...$this->defaultDates()], null);
    }

    private function createRequest(Lead $lead, array $data, ?User $actor): FreeTrial
    {
        $data = Validator::make($data, ['trial_type' => 'required|in:equity,index_options,commodity,combo', 'start_date' => 'required|date_format:Y-m-d', 'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date', 'scope_description' => 'nullable|string|max:1000'])->validate();

        return DB::transaction(function () use ($lead, $data, $actor): FreeTrial {
            Lead::whereKey($lead->id)->lockForUpdate()->firstOrFail();
            $existing = FreeTrial::where('lead_id', $lead->id)->whereIn('status', ['requested', 'approved', 'active'])->whereDate('end_date', '>=', Carbon::now('Asia/Kolkata')->toDateString())->first();
            if ($existing) {
                return $existing;
            }
            $trial = FreeTrial::create([...$data, 'lead_id' => $lead->id, 'employee_id' => $lead->assigned_employee_id, 'client_id' => Client::where('lead_id', $lead->id)->value('id'), 'trial_code' => 'DEMO-'.strtoupper(Str::random(10)), 'status' => 'requested']);
            $lead->update(['demo_requested_at' => now()]);
            $this->audit->record('trial.requested', $trial, new: ['lead_id' => $lead->id, 'start_date' => $data['start_date'], 'end_date' => $data['end_date']], actor: $actor);

            return $trial;
        });
    }

    public function approve(User $actor, FreeTrial $trial): void
    {
        DB::transaction(function () use ($actor, $trial): void {
            $trial = FreeTrial::whereKey($trial->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($actor)->authorize('approve', $trial);
            $first = $this->firstSession($trial->start_date->toDateString(), $trial->trial_type);
            if ($first->toDateString() > $trial->end_date->toDateString()) {
                throw ValidationException::withMessages(['end_date' => 'Choose an end date covering an available trading session.']);
            }
            $trial->update(['status' => 'approved', 'approved_by' => $actor->id, 'approved_at' => now()]);
            $this->audit->record('trial.approved', $trial, actor: $actor);
        });
        $this->activateApprovedTrials();
    }

    public function activateApprovedTrials(): int
    {
        $now = Carbon::now('Asia/Kolkata');
        $activated = 0;
        foreach (FreeTrial::where('status', 'approved')->whereDate('start_date', '<=', $now->toDateString())->whereDate('end_date', '>=', $now->toDateString())->with(['lead', 'approver'])->orderBy('id')->limit(100)->get() as $candidate) {
            DB::transaction(function () use ($candidate, $now, &$activated): void {
                $trial = FreeTrial::whereKey($candidate->id)->lockForUpdate()->firstOrFail();
                if ($trial->status !== 'approved' || ! $trial->lead || ! $trial->approver?->isActive() || ! $trial->approver->can('leads.assign') || ! $trial->approver->can('view', $trial->lead)) {
                    return;
                }
                $first = $this->firstSession($trial->start_date->toDateString(), $trial->trial_type);
                if (! $first->isSameDay($now) || $now->lt($first) || in_array($trial->lead->status, ['DND', 'PAID', 'CONVERTED'], true)) {
                    return;
                }
                $trial->update(['status' => 'active']);
                $trial->lead->update(['status' => 'FREE_TRIAL']);
                $review = $first->copy()->setTimeFromTimeString(config('crm.sessions.'.$trial->trial_type.'.review', '15:45'));
                $trial->update(['interim_checkin_date' => $review->toDateString(), 'review_meeting_date' => $review->toDateString()]);
                $common = ['trial_id' => $trial->id];
                $this->engine->scheduleAction($trial->lead, null, 'send_trial_activation', [
                    ...$common, 'template_name' => 'esc_trial_activation_v1', 'parameters' => [$trial->lead->full_name, $trial->trial_type, $trial->start_date->toDateString(), $trial->end_date->toDateString(), rtrim(config('platform.frontend_url'), '/').'/portal'],
                ]);
                $this->engine->scheduleAction($trial->lead, null, 'send_trial_review', [
                    ...$common, 'template_name' => 'esc_trial_day1_review_v1', 'parameters' => [$trial->lead->full_name, $trial->trial_code],
                ], max(0, (int) ceil(now()->diffInMinutes($review, false))));
                Task::firstOrCreate(['taskable_type' => FreeTrial::class, 'taskable_id' => $trial->id, 'title' => 'Review trial '.$trial->trial_code],
                    ['assignee_employee_id' => $trial->employee_id, 'created_by' => $trial->approved_by, 'description' => 'Review first-session experience and respond to client feedback.', 'priority' => 'normal', 'status' => 'open', 'due_at' => $review]);
                $this->audit->record('trial.activated', $trial, actor: $trial->approver);
                $activated++;
            });
        }
        FreeTrial::whereIn('status', ['requested', 'approved', 'active'])->whereHas('lead', fn ($q) => $q->whereIn('status', ['PAID', 'CONVERTED']))->update(['status' => 'converted']);
        FreeTrial::whereIn('status', ['approved', 'active'])->whereDate('end_date', '<', $now->toDateString())->update(['status' => 'completed']);

        return $activated;
    }

    public function cancel(User $actor, FreeTrial $trial, string $reason): void
    {
        Gate::forUser($actor)->authorize('cancel', $trial);
        Validator::make(['reason' => $reason], ['reason' => 'required|string|min:10|max:500'])->validate();
        DB::transaction(function () use ($actor, $trial, $reason): void {
            $trial->update(['status' => 'cancelled']);
            ScheduledAction::where('lead_id', $trial->lead_id)->where('status', 'pending')->where('action_payload_json->trial_id', $trial->id)->update(['status' => 'cancelled', 'execution_error' => 'Trial cancelled.']);
            $this->audit->record('trial.cancelled', $trial, reason: $reason, actor: $actor);
        });
    }
}
