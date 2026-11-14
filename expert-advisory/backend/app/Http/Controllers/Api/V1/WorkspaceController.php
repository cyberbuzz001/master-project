<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Crm\LeadIntakeService;
use App\Domain\Crm\PhoneNormalizer;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\PaymentInstallment;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Employee workspace and client portal read models. All queries are scoped to the signed-in user.
 */
final class WorkspaceController extends Controller
{
    public function __construct(private readonly LeadIntakeService $leadIntake) {}

    public function employeeDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz = config('platform.timezone_display');
        $startOfToday = now($tz)->startOfDay()->utc();
        $endOfToday = now($tz)->endOfDay()->utc();
        $visible = Lead::query()->visibleTo($user);
        $empId = $user->employee?->id;

        $confirmedCollections = Payment::query()
            ->where('status', Payment::SUCCEEDED)
            ->when(! $user->can('payments.view'), fn ($q) => $q->whereRaw('1 = 0'))
            ->when(! $user->can('leads.view_all') && $empId, function ($q) use ($empId) {
                $q->whereHas('client', fn ($cq) => $cq->where('relationship_manager_employee_id', $empId));
            })
            ->sum('amount_paise');

        $installmentsDue = PaymentInstallment::query()
            ->where('due_date', '<=', $endOfToday)
            ->whereIn('status', ['due', 'promised', 'overdue'])
            ->when(! $user->can('leads.view_all') && $empId, function ($q) use ($empId) {
                $q->whereHas('client', fn ($cq) => $cq->where('relationship_manager_employee_id', $empId));
            })
            ->count();

        $activeTrials = FreeTrial::query()
            ->where('status', 'active')
            ->when(! $user->can('leads.view_all') && $empId, fn ($q) => $q->where('employee_id', $empId))
            ->count();

        $trialReviewsDue = FreeTrial::query()
            ->whereIn('status', ['active', 'completed'])
            ->where('review_meeting_date', '<=', $endOfToday)
            ->when(! $user->can('leads.view_all') && $empId, fn ($q) => $q->where('employee_id', $empId))
            ->count();

        $tasksCompletedToday = Task::query()
            ->where('status', 'done')
            ->whereBetween('completed_at', [$startOfToday, $endOfToday])
            ->when($empId, fn ($q) => $q->where('assignee_employee_id', $empId))
            ->count();

        return ApiResponse::success([
            'employee' => $user->employee?->only(['employee_code', 'designation']),
            'scope' => $user->can('leads.view_all') ? 'all' : ($user->can('leads.view_team') ? 'team' : 'own'),
            'metrics' => [
                'total_leads' => (clone $visible)->count(),
                'fresh_leads' => (clone $visible)->where('status', 'NEW')->count(),
                'callbacks_due_today' => (clone $visible)->where('status', 'CALL_BACK')->whereNotNull('next_followup_at')->whereBetween('next_followup_at', [$startOfToday, $endOfToday])->count(),
                'overdue_followups' => (clone $visible)->whereNotNull('next_followup_at')->where('next_followup_at', '<', now()->utc())->count(),
                'followups_due_today' => (clone $visible)->whereNotNull('next_followup_at')->where('next_followup_at', '<=', $endOfToday)->count(),
                'active_trials' => $activeTrials,
                'trial_reviews_due' => $trialReviewsDue,
                'payment_installments_due' => $installmentsDue,
                'tasks_completed_today' => $tasksCompletedToday,
                'confirmed_collections_rupees' => round($confirmedCollections / 100, 2),
                'by_status' => (clone $visible)->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status'),
            ],
            'modules' => [
                ['key' => 'tasks', 'label' => 'Tasks & call logging', 'enabled' => true, 'phase' => 2],
                ['key' => 'trials', 'label' => 'Free trial desk', 'enabled' => true, 'phase' => 3],
                ['key' => 'installments', 'label' => 'Installments & recovery', 'enabled' => true, 'phase' => 4],
                ['key' => 'objections', 'label' => 'Objection handling desk', 'enabled' => true, 'phase' => 4],
                ['key' => 'ai_assistant', 'label' => 'AI sales assistant', 'enabled' => true, 'phase' => 6],
            ],
        ]);
    }

    public function employeeLeads(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter.status' => ['nullable', Rule::in(Lead::STATUSES)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Lead::query()->visibleTo($request->user())->with(['source:id,code,name', 'campaign:id,code,name', 'assignedEmployee.user:id,name'])->latest('id');

        if ($status = data_get($filters, 'filter.status')) {
            $query->where('status', $status);
        }

        if ($search = $filters['search'] ?? null) {
            $query->where(fn ($q) => $q->where('full_name', 'like', "%{$search}%")->orWhere('mobile', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }

        return ApiResponse::paginated($query->paginate($filters['per_page'] ?? 25), fn (Lead $lead) => [
            'id' => $lead->uuid,
            'full_name' => $lead->full_name,
            'mobile' => $lead->mobile,
            'email' => $lead->email,
            'city' => $lead->city,
            'status' => $lead->status,
            'segments' => $lead->preferred_segments ?? [],
            'source' => $lead->source?->name,
            'campaign' => $lead->campaign?->name,
            'assigned_to' => $lead->assignedEmployee?->user?->name,
            'possible_duplicate' => $lead->duplicate_of_lead_id !== null,
            'next_followup_at' => $lead->next_followup_at?->toIso8601String(),
            'created_at' => $lead->created_at?->toIso8601String(),
        ]);
    }

    public function storeEmployeeLead(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('leads.create'), 403);
        $data = $request->validate([
            'full_name' => ['nullable', 'string', 'max:120'],
            'mobile' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
            'capital_range' => ['nullable', 'string', 'max:24'],
            'preferred_segments' => ['nullable', 'array', 'max:4'],
            'message' => ['nullable', 'string', 'max:2000'],
            'consent_channel' => ['nullable', 'string', 'max:32'],
            'consent_calls' => ['nullable', 'boolean'],
            'consent_whatsapp' => ['nullable', 'boolean'],
        ]);
        $lead = $this->leadIntake->createByStaff($request->user(), $data);

        return ApiResponse::success($this->leadPayload($lead), status: 201);
    }

    public function updateEmployeeLead(Request $request, string $lead): JsonResponse
    {
        $record = $this->resolveLead($lead);
        abort_unless($request->user()->can('update', $record), 403);
        $data = $request->validate([
            'full_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'mobile' => ['sometimes', 'required', 'string', 'max:20'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'capital_range' => ['sometimes', 'nullable', 'string', 'max:24'],
            'preferred_segments' => ['sometimes', 'nullable', 'array', 'max:4'],
            'message' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(Lead::STATUSES)],
        ]);
        if (array_key_exists('mobile', $data)) {
            $data['mobile'] = PhoneNormalizer::toE164($data['mobile']);
            $duplicate = Lead::query()->where('mobile', $data['mobile'])->where('id', '!=', $record->getKey())->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['mobile' => ['This mobile number already belongs to another lead.']]);
            }
        }
        $record->fill($data)->save();

        return ApiResponse::success($this->leadPayload($record->fresh()));
    }

    public function deleteEmployeeLead(Request $request, string $lead): JsonResponse
    {
        $record = $this->resolveLead($lead);
        abort_unless($request->user()->can('delete', $record), 403);
        $record->delete();

        return ApiResponse::success(['deleted' => true]);
    }

    private function resolveLead(string $identifier): Lead
    {
        return Lead::query()->where('uuid', $identifier)->orWhereKey($identifier)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function leadPayload(Lead $lead): array
    {
        return [
            'id' => $lead->uuid,
            'full_name' => $lead->full_name,
            'mobile' => $lead->mobile,
            'email' => $lead->email,
            'city' => $lead->city,
            'status' => $lead->status,
            'segments' => $lead->preferred_segments ?? [],
            'possible_duplicate' => $lead->duplicate_of_lead_id !== null,
            'created_at' => $lead->created_at?->toIso8601String(),
        ];
    }

    public function clientDashboard(Request $request): JsonResponse
    {
        $client = $request->user()->client;

        return ApiResponse::success([
            'client' => $client === null ? null : [
                'client_code' => $client->client_code,
                'full_name' => $client->full_name,
                'onboarding_status' => $client->onboarding_status,
                'relationship_manager' => $client->relationshipManager?->user?->name,
            ],
            'trials' => $client === null ? [] : FreeTrial::query()->where(function ($query) use ($client): void {
                $query->where('client_id', $client->id);
                if ($client->lead_id) {
                    $query->orWhere('lead_id', $client->lead_id);
                }
            })->latest('id')->limit(10)->get()->map(fn ($trial): array => [
                'trial_code' => $trial->trial_code, 'trial_type' => $trial->trial_type, 'status' => $trial->status,
                'start_date' => $trial->start_date->toDateString(), 'end_date' => $trial->end_date->toDateString(),
                'review_meeting_date' => $trial->review_meeting_date?->toDateString(),
            ])->all(),
            'notices' => [
                [
                    'key' => 'market_risk',
                    'title' => 'Market risk',
                    'body' => 'Investments in the securities market are subject to market risks. Research is not a guarantee of returns. Read all related documents carefully before investing.',
                ],
            ],
            'modules' => [
                ['key' => 'risk_profile', 'label' => 'Risk profile', 'enabled' => true, 'phase' => 3],
                ['key' => 'documents', 'label' => 'Documents & KYC', 'enabled' => true, 'phase' => 3],
                ['key' => 'subscription', 'label' => 'Subscription, invoices & payments', 'enabled' => true, 'phase' => 4],
                ['key' => 'research', 'label' => 'Research reports', 'enabled' => false, 'phase' => 5],
                ['key' => 'support', 'label' => 'Support tickets', 'enabled' => false, 'phase' => 8],
            ],
        ]);
    }
}
