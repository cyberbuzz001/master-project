<?php

namespace App\Filament\Widgets;

use App\Models\Employee;
use App\Models\Followup;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder;

/**
 * Today's activity per employee for team leaders and managers. Revenue leaderboards arrive
 * with verified payments (Phase 4), so none are shown from unverified data.
 */
class TeamActivityTable extends TableWidget
{
    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Team activity today';

    public static function canView(): bool
    {
        return auth()->user()->canAny(['leads.view_team', 'leads.view_all']);
    }

    public function table(Table $table): Table
    {
        $user = auth()->user();
        $tz = config('platform.timezone_display');
        $startOfToday = now($tz)->startOfDay()->utc();

        return $table
            ->query(function () use ($user, $startOfToday): Builder {
                $query = Employee::query()
                    ->where('status', 'active')
                    ->whereHas('user', fn (Builder $u) => $u->where('status', 'active')->whereHas('roles.permissions', fn (Builder $p) => $p->where('name', 'leads.view_own')))
                    ->with('user:id,name')
                    ->withCount([
                        'assignedLeads as open_leads' => fn (Builder $q) => $q->whereIn('status', ['NEW', 'NPC', 'CALL_BACK', 'FOLLOW_UP', 'FREE_TRIAL', 'EXPECTED_PAYMENT']),
                        'followups as overdue_followups' => fn (Builder $q) => $q->whereIn('status', [Followup::PENDING, Followup::MISSED])->where('due_at', '<', now()),
                    ])
                    ->addSelect([
                        'calls_today' => \App\Models\CallLog::query()->selectRaw('count(*)')->whereColumn('employee_id', 'employees.id')->where('called_at', '>=', $startOfToday),
                        'connected_today' => \App\Models\CallLog::query()->selectRaw('count(*)')->whereColumn('employee_id', 'employees.id')->where('called_at', '>=', $startOfToday)->where('outcome', 'connected'),
                    ]);

                if (! $user->can('leads.view_all')) {
                    $query->where('team_id', $user->employee?->team_id ?? 0);
                }

                return $query;
            })
            ->defaultSort('calls_today', 'desc')
            ->paginated([10, 25])
            ->columns([
                TextColumn::make('user.name')->label('Employee')->weight('medium'),
                TextColumn::make('calls_today')->label('Calls today')->numeric()->sortable(),
                TextColumn::make('connected_today')->label('Connected')->numeric()->sortable(),
                TextColumn::make('open_leads')->label('Open leads')->numeric()->sortable(),
                TextColumn::make('overdue_followups')->label('Overdue follow-ups')->numeric()->sortable()
                    ->color(fn (int $state) => $state > 0 ? 'danger' : null),
            ]);
    }
}
