<?php

namespace App\Filament\Resources\Leads\Pages;

use App\Filament\Resources\Leads\LeadResource;
use App\Models\Lead;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListLeads extends ListRecords
{
    protected static string $resource = LeadResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->label('New lead')];
    }

    public function getTabs(): array
    {
        $endOfToday = now(config('platform.timezone_display'))->endOfDay()->utc();
        $scoped = fn () => LeadResource::getEloquentQuery();

        return [
            'working' => Tab::make('Working')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['NEW', 'NPC', 'CALL_BACK', 'FOLLOW_UP'])),
            'due' => Tab::make('Due today')
                ->badge(fn () => $scoped()->whereNotNull('next_followup_at')->where('next_followup_at', '<=', $endOfToday)->count() ?: null)
                ->badgeColor('danger')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereNotNull('next_followup_at')->where('next_followup_at', '<=', $endOfToday)->reorder('next_followup_at')),
            'new' => Tab::make('New')
                ->badge(fn () => $scoped()->where('status', 'NEW')->count() ?: null)
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'NEW')),
            'pipeline' => Tab::make('Trials & payments')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['FREE_TRIAL', 'EXPECTED_PAYMENT'])),
            'won' => Tab::make('Paid & converted')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['PAID', 'CONVERTED'])),
            'closed' => Tab::make('Closed')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['NOT_INTERESTED', 'DND', 'INVALID', 'LOST'])),
            'all' => Tab::make('All'),
        ];
    }

    public function getDefaultActiveTab(): string|int|null
    {
        return 'working';
    }
}
