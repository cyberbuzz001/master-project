<?php

namespace App\Filament\Resources\Leads\Schemas;

use App\Domain\Crm\LeadStatus;
use App\Filament\Resources\Leads\LeadResource;
use App\Models\Lead;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

class LeadInfolist
{
    public static function configure(Schema $schema): Schema
    {
        $tz = config('platform.timezone_display');

        return $schema->columns(3)->components([
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 2])->schema([
                Section::make('Status')
                    ->icon(Heroicon::OutlinedFlag)
                    ->columns(['default' => 2, 'md' => 4])
                    ->schema([
                        TextEntry::make('status')
                            ->badge()
                            ->formatStateUsing(fn (string $state) => LeadStatus::tryFrom($state)?->getLabel() ?? $state)
                            ->color(fn (string $state) => LeadStatus::tryFrom($state)?->getColor() ?? 'gray'),
                        TextEntry::make('assignedEmployee.user.name')->label('Owner')->placeholder('Unassigned'),
                        TextEntry::make('next_followup_at')->label('Next follow-up')->dateTime('d M Y, h:i A', $tz)->placeholder('None scheduled')
                            ->color(fn (Lead $record) => $record->next_followup_at?->isPast() ? 'danger' : null),
                        TextEntry::make('last_contacted_at')->label('Last contact')->since($tz)->placeholder('Never'),
                        TextEntry::make('npc_attempts')
                            ->label('Unanswered calls')
                            ->state(fn (Lead $record) => $record->callLogs()->whereIn('outcome', ['no_answer', 'busy', 'switched_off'])->count())
                            ->color(fn (int $state) => $state >= (int) config('crm_playbook.statuses.NPC.attempt_threshold', 7) ? 'danger' : null),
                        TextEntry::make('escalated_at')->label('Escalated')->since($tz)->color('danger')->icon('heroicon-s-exclamation-triangle')
                            ->visible(fn (Lead $record) => $record->escalated_at !== null),
                        TextEntry::make('calls_total')->label('Calls logged')->state(fn (Lead $record) => $record->callLogs()->count()),
                        TextEntry::make('duplicateOf.full_name')
                            ->label('Possible duplicate of')
                            ->visible(fn (Lead $record) => $record->duplicate_of_lead_id !== null)
                            ->color('warning')
                            ->url(fn (Lead $record) => $record->duplicate_of_lead_id && auth()->user()->can('view', $record->duplicateOf) ? LeadResource::getUrl('view', ['record' => $record->duplicate_of_lead_id]) : null),
                    ]),
                Section::make('Contact & profile')
                    ->icon(Heroicon::OutlinedIdentification)
                    ->columns(['default' => 1, 'md' => 3])
                    ->schema([
                        TextEntry::make('mobile')->copyable()->icon(Heroicon::OutlinedPhone),
                        TextEntry::make('email')->copyable()->placeholder('—')->icon(Heroicon::OutlinedEnvelope),
                        TextEntry::make('location')->state(fn (Lead $record) => collect([$record->city, $record->state])->filter()->join(', ') ?: null)->placeholder('—'),
                        TextEntry::make('preferred_segments')->label('Markets')->badge()->color('gray')->formatStateUsing(fn (string $state) => LeadForm::SEGMENTS[$state] ?? $state)->placeholder('—'),
                        TextEntry::make('capital_range')->formatStateUsing(fn (?string $state) => LeadForm::CAPITAL[$state] ?? $state)->placeholder('—'),
                        TextEntry::make('trading_experience')->formatStateUsing(fn (?string $state) => LeadForm::EXPERIENCE[$state] ?? $state)->placeholder('—'),
                        TextEntry::make('message')->label('Enquiry notes')->columnSpanFull()->placeholder('—'),
                    ]),
                Section::make('Activity timeline')
                    ->icon(Heroicon::OutlinedClock)
                    ->schema([View::make('filament.leads.timeline')]),
            ]),
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 1])->schema([
                Section::make('Playbook')
                    ->icon(Heroicon::OutlinedLightBulb)
                    ->description('What to do at this stage')
                    ->schema([View::make('filament.leads.playbook')]),
                Section::make('Consent')
                    ->icon(Heroicon::OutlinedShieldCheck)
                    ->description('Latest record per purpose')
                    ->schema([View::make('filament.leads.consents')]),
                Section::make('Source')
                    ->icon(Heroicon::OutlinedMegaphone)
                    ->collapsible()
                    ->schema([
                        TextEntry::make('source.name')->label('Source')->placeholder('—'),
                        TextEntry::make('campaign.name')->label('Campaign')->placeholder('—'),
                        TextEntry::make('vendor.name')->label('Vendor')->placeholder('—'),
                        TextEntry::make('attributions.0.utm_source')->label('UTM source / medium')
                            ->state(fn (Lead $record) => collect([$record->attributions->first()?->utm_source, $record->attributions->first()?->utm_medium])->filter()->join(' / ') ?: null)
                            ->placeholder('—'),
                        TextEntry::make('created_at')->label('Received')->dateTime('d M Y, h:i A', $tz),
                    ]),
            ]),
        ]);
    }
}
