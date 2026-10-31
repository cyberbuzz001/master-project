<?php

namespace App\Filament\Resources\Leads\Pages;

use App\Filament\Exports\LeadExporter;
use App\Filament\Imports\LeadImporter;
use App\Filament\Resources\LeadImportBatches\LeadImportBatchResource;
use App\Filament\Resources\Leads\LeadResource;
use App\Models\Lead;
use Filament\Actions\CreateAction;
use Filament\Actions\ExportAction;
use Filament\Actions\ImportAction;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Support\Icons\Heroicon;
use Illuminate\Database\Eloquent\Builder;

class ListLeads extends ListRecords
{
    protected static string $resource = LeadResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->label('New lead')->icon(Heroicon::OutlinedUserPlus),
            LeadImportBatchResource::getUniversalImportAction(),
            ImportAction::make()
                ->importer(LeadImporter::class)
                ->label('Import CSV')
                ->icon(Heroicon::OutlinedArrowUpTray)
                ->color('gray')
                ->visible(fn () => auth()->user()?->can('leads.import') ?? true),
            ExportAction::make()
                ->exporter(LeadExporter::class)
                ->label('Export Leads')
                ->icon(Heroicon::OutlinedArrowDownTray)
                ->color('gray')
                ->visible(fn () => auth()->user()?->can('leads.export') ?? true),
        ];
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
            'handoff' => Tab::make('AI Handoff Queue')
                ->badge(fn () => $scoped()->where(fn (Builder $q) => $q->where('is_ai_paused', true)->orWhere('ai_conversation_state', 'HUMAN_AGENT_REQUESTED'))->count() ?: null)
                ->badgeColor('warning')
                ->modifyQueryUsing(fn (Builder $query) => $query->where(fn (Builder $q) => $q->where('is_ai_paused', true)->orWhere('ai_conversation_state', 'HUMAN_AGENT_REQUESTED'))),
            'hot' => Tab::make('Hot Leads (AI)')
                ->badge(fn () => $scoped()->where(fn (Builder $q) => $q->where('ai_grade', 'HOT')->orWhere('ai_score', '>=', 75))->count() ?: null)
                ->badgeColor('danger')
                ->modifyQueryUsing(fn (Builder $query) => $query->where(fn (Builder $q) => $q->where('ai_grade', 'HOT')->orWhere('ai_score', '>=', 75))),
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
