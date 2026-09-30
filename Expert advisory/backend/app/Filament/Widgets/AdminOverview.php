<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\PolicyDocuments\PolicyDocumentResource;
use App\Filament\Resources\RegulatoryProfiles\RegulatoryProfileResource;
use App\Filament\Resources\Users\UserResource;
use App\Models\AuditLog;
use App\Models\LoginHistory;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class AdminOverview extends StatsOverviewWidget
{
    protected static ?int $sort = 0;

    protected ?string $heading = 'Security & compliance';

    public static function canView(): bool
    {
        return auth()->user()->can('dashboard.admin.view');
    }

    protected function getStats(): array
    {
        $staff = User::query()->withoutDemo()->where('user_type', User::TYPE_STAFF)->where('status', User::STATUS_ACTIVE);
        $without2fa = (clone $staff)->whereNull('two_factor_confirmed_at')->count();
        $locked = User::query()->where('locked_until', '>', now())->count();
        $failed = LoginHistory::query()->whereIn('outcome', [LoginHistory::FAILED, LoginHistory::TWO_FACTOR_FAILED])->where('created_at', '>=', now()->subDay())->count();
        $pendingProfile = RegulatoryProfileVersion::query()->where('status', RegulatoryProfileVersion::PENDING)->count();
        $verifiedProfile = RegulatoryProfileVersion::query()->where('status', RegulatoryProfileVersion::VERIFIED)->exists();
        $policyQueue = PolicyDocumentVersion::query()->whereIn('status', [PolicyDocumentVersion::DRAFT, PolicyDocumentVersion::APPROVED])->count();
        $overdueReviews = PolicyDocumentVersion::query()->where('status', PolicyDocumentVersion::PUBLISHED)->whereNotNull('review_due_at')->where('review_due_at', '<', now()->toDateString())->count();

        return [
            Stat::make('Active staff', (clone $staff)->count())
                ->description($without2fa > 0 ? "{$without2fa} without 2FA" : 'All enrolled in 2FA')
                ->color($without2fa > 0 ? 'warning' : 'success')
                ->url(UserResource::getUrl('index')),
            Stat::make('Failed sign-ins (24h)', $failed)
                ->description("{$locked} locked account(s) · ".AuditLog::query()->where('created_at', '>=', now()->subDay())->count().' audit events')
                ->color($failed > 20 || $locked > 0 ? 'danger' : 'gray'),
            Stat::make('Regulatory profile', $verifiedProfile ? 'Verified' : 'Not verified')
                ->description($pendingProfile > 0 ? "{$pendingProfile} version(s) awaiting verification" : 'Research publication requires a verified profile')
                ->color($verifiedProfile ? 'success' : 'danger')
                ->url(RegulatoryProfileResource::getUrl('index')),
            Stat::make('Policy workflow', $policyQueue)
                ->description($overdueReviews > 0 ? "{$overdueReviews} published polic(ies) overdue for review" : 'Drafts and approved versions in the queue')
                ->color($overdueReviews > 0 ? 'danger' : 'gray')
                ->url(PolicyDocumentResource::getUrl('index')),
            Stat::make('System health', $this->healthSummary())->color(str_contains($this->healthSummary(), 'issue') ? 'danger' : 'success'),
        ];
    }

    private function healthSummary(): string
    {
        return once(function (): string {
            $problems = [];
            try {
                DB::select('select 1');
            } catch (Throwable) {
                $problems[] = 'database';
            }
            try {
                Cache::put('health:probe', 1, 10);
                if (Cache::get('health:probe') !== 1) {
                    $problems[] = 'cache';
                }
            } catch (Throwable) {
                $problems[] = 'cache';
            }

            return $problems === [] ? 'Database & cache OK' : 'Health issue: '.implode(', ', $problems);
        });
    }
}
