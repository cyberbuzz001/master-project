<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Employee workspace and client portal read models. All queries are scoped to the signed-in user.
 */
final class WorkspaceController extends Controller
{
    public function employeeDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $endOfToday = now(config('platform.timezone_display'))->endOfDay()->utc();
        $visible = Lead::query()->visibleTo($user);

        return ApiResponse::success([
            'employee' => $user->employee?->only(['employee_code', 'designation']),
            'scope' => $user->can('leads.view_all') ? 'all' : ($user->can('leads.view_team') ? 'team' : 'own'),
            'leads' => [
                'total' => (clone $visible)->count(),
                'followups_due' => (clone $visible)->whereNotNull('next_followup_at')->where('next_followup_at', '<=', $endOfToday)->count(),
                'new' => (clone $visible)->where('status', 'NEW')->count(),
                'free_trials' => (clone $visible)->where('status', 'FREE_TRIAL')->count(),
                'by_status' => (clone $visible)->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status'),
            ],
            'modules' => [
                ['key' => 'tasks', 'label' => 'Tasks & call logging', 'enabled' => false, 'phase' => 2],
                ['key' => 'payments', 'label' => 'Payment status', 'enabled' => false, 'phase' => 4],
                ['key' => 'ai_assistant', 'label' => 'AI sales assistant', 'enabled' => false, 'phase' => 6],
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
