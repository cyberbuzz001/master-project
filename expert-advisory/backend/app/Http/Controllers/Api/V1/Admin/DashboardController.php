<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Compliance\ComplianceGate;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\AuditLog;
use App\Models\Lead;
use App\Models\LoginHistory;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class DashboardController extends Controller
{
    /**
     * Command-center modules and the phase that delivers them. Modules that are not live
     * report `enabled: false` instead of placeholder numbers.
     */
    private const MODULES = [
        'crm' => ['label' => 'CRM, follow-ups & campaigns', 'phase' => 2],
        'onboarding' => ['label' => 'Risk profiles, KYC & onboarding', 'phase' => 3],
        'billing' => ['label' => 'Invoices, payments & subscriptions', 'phase' => 4],
        'research' => ['label' => 'Research workflow & approvals', 'phase' => 5],
        'ai' => ['label' => 'AI agents, usage & cost', 'phase' => 6],
        'messaging' => ['label' => 'Email, WhatsApp & automation', 'phase' => 7],
        'analytics' => ['label' => 'Analytics, complaints & support', 'phase' => 8],
    ];

    public function __construct(private readonly ComplianceGate $gate) {}

    public function __invoke(): JsonResponse
    {
        $today = now(config('platform.timezone_display'))->startOfDay()->utc();
        $leads = Lead::query()->withoutDemo();

        $readiness = $this->gate->readiness();

        return ApiResponse::success([
            'generated_at' => now()->toIso8601String(),
            'leads' => [
                'total' => (clone $leads)->count(),
                'new_today' => (clone $leads)->where('created_at', '>=', $today)->count(),
                'unassigned' => (clone $leads)->whereNull('assigned_employee_id')->whereNull('duplicate_of_lead_id')->count(),
                'possible_duplicates' => (clone $leads)->whereNotNull('duplicate_of_lead_id')->count(),
                'by_status' => (clone $leads)->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status'),
            ],
            'people' => [
                'active_staff' => User::query()->withoutDemo()->where('user_type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE)->count(),
                'staff_without_2fa' => User::query()->withoutDemo()->where('user_type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE)->whereNull('two_factor_confirmed_at')->count(),
                'client_accounts' => User::query()->withoutDemo()->where('user_type', User::TYPE_CLIENT)->count(),
                'locked_accounts' => User::query()->withoutDemo()->where('locked_until', '>', now())->count(),
            ],
            'security' => [
                'failed_logins_24h' => LoginHistory::query()->whereIn('outcome', [LoginHistory::FAILED, LoginHistory::TWO_FACTOR_FAILED])->where('created_at', '>=', now()->subDay())->count(),
                'audit_events_24h' => AuditLog::query()->where('created_at', '>=', now()->subDay())->count(),
            ],
            'compliance' => [
                'publication_ready' => collect($readiness)->every(fn ($c) => $c['passed']),
                'checks' => $readiness,
                'profile_pending_verification' => RegulatoryProfileVersion::query()->where('status', RegulatoryProfileVersion::PENDING)->count(),
                'policies_awaiting_approval' => PolicyDocumentVersion::query()->where('status', PolicyDocumentVersion::DRAFT)->count(),
                'policies_approved_unpublished' => PolicyDocumentVersion::query()->where('status', PolicyDocumentVersion::APPROVED)->count(),
                'policies_review_overdue' => PolicyDocumentVersion::query()->where('status', PolicyDocumentVersion::PUBLISHED)->whereNotNull('review_due_at')->where('review_due_at', '<', now()->toDateString())->count(),
            ],
            'system' => $this->health(),
            'modules' => collect(self::MODULES)->map(fn ($m, $key) => ['key' => $key, 'enabled' => false] + $m)->values(),
        ]);
    }

    /**
     * @return array<string, array{ok: bool, detail: string}>
     */
    private function health(): array
    {
        $probe = function (callable $fn): array {
            try {
                return ['ok' => true, 'detail' => (string) $fn()];
            } catch (Throwable $e) {
                report($e);

                return ['ok' => false, 'detail' => class_basename($e)];
            }
        };

        return [
            'database' => $probe(function () {
                DB::select('select 1');

                return DB::connection()->getDriverName();
            }),
            'cache' => $probe(function () {
                Cache::put('health:probe', 1, 10);

                return Cache::get('health:probe') === 1 ? config('cache.default') : throw new \RuntimeException('Cache read-back failed');
            }),
            'storage' => $probe(function () {
                Storage::disk('local')->put('health/probe.txt', (string) now()->getTimestamp());

                return 'local';
            }),
            'queue' => $probe(fn () => config('queue.default')),
        ];
    }
}
