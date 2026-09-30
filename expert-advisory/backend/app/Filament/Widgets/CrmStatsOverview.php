<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\Followups\FollowupResource;
use App\Filament\Resources\Leads\LeadResource;
use App\Models\CallLog;
use App\Models\Followup;
use App\Models\Lead;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/**
 * Workload for the signed-in user's scope (own, team or all leads).
 */
class CrmStatsOverview extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected ?string $pollingInterval = '120s';

    public static function canView(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    protected function getStats(): array
    {
        $user = auth()->user();
        $tz = config('platform.timezone_display');
        $startOfToday = now($tz)->startOfDay()->utc();
        $endOfToday = now($tz)->endOfDay()->utc();
        $leads = fn () => Lead::query()->visibleTo($user);

        $due = Followup::query()->visibleTo($user)->whereIn('status', [Followup::PENDING, Followup::MISSED])->where('due_at', '<=', $endOfToday)->count();
        $overdue = Followup::query()->visibleTo($user)->whereIn('status', [Followup::PENDING, Followup::MISSED])->where('due_at', '<', now())->count();
        $new = $leads()->where('status', 'NEW')->count();
        $newToday = $leads()->where('created_at', '>=', $startOfToday)->count();
        $pipeline = $leads()->whereIn('status', ['FREE_TRIAL', 'EXPECTED_PAYMENT'])->count();
        $expected = $leads()->where('status', 'EXPECTED_PAYMENT')->count();
        $calls = CallLog::query()->whereHas('lead', fn ($q) => $q->visibleTo($user))->where('called_at', '>=', $startOfToday);
        $callsToday = (clone $calls)->count();
        $connected = (clone $calls)->where('outcome', 'connected')->count();

        return [
            Stat::make('Follow-ups due today', $due)
                ->description($overdue > 0 ? "{$overdue} overdue" : 'Nothing overdue')
                ->descriptionIcon($overdue > 0 ? 'heroicon-m-exclamation-triangle' : 'heroicon-m-check-circle')
                ->color($overdue > 0 ? 'danger' : 'success')
                ->url(FollowupResource::getUrl('index')),
            Stat::make('New leads to call', $new)
                ->description("{$newToday} received today")
                ->descriptionIcon('heroicon-m-inbox-arrow-down')
                ->color('info')
                ->url(LeadResource::getUrl('index', ['tab' => 'new'])),
            Stat::make('Trials & expected payments', $pipeline)
                ->description("{$expected} expecting payment")
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('primary')
                ->url(LeadResource::getUrl('index', ['tab' => 'pipeline'])),
            Stat::make('Calls logged today', $callsToday)
                ->description("{$connected} connected")
                ->descriptionIcon('heroicon-m-phone')
                ->color('gray'),
        ];
    }
}
