<?php

namespace App\Filament\Resources\Followups\Pages;

use App\Filament\Resources\Followups\FollowupResource;
use App\Models\Followup;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListFollowups extends ListRecords
{
    protected static string $resource = FollowupResource::class;

    public function getTabs(): array
    {
        $tz = config('platform.timezone_display');
        $startOfToday = now($tz)->startOfDay()->utc();
        $endOfToday = now($tz)->endOfDay()->utc();
        $open = [Followup::PENDING, Followup::MISSED];
        $count = fn (callable $scope) => ($n = $scope(FollowupResource::getEloquentQuery())->count()) > 0 ? $n : null;

        $overdue = fn (Builder $query) => $query->whereIn('status', $open)->where('due_at', '<', $startOfToday);
        $today = fn (Builder $query) => $query->whereIn('status', $open)->whereBetween('due_at', [$startOfToday, $endOfToday]);

        return [
            'today' => Tab::make('Today')->badge(fn () => $count($today))->modifyQueryUsing($today),
            'overdue' => Tab::make('Overdue')->badge(fn () => $count($overdue))->badgeColor('danger')->modifyQueryUsing($overdue),
            'upcoming' => Tab::make('Upcoming')->modifyQueryUsing(fn (Builder $query) => $query->where('status', Followup::PENDING)->where('due_at', '>', $endOfToday)),
            'done' => Tab::make('Completed')->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', [Followup::DONE, Followup::CANCELLED])->reorder('completed_at', 'desc')),
        ];
    }
}
