<?php

namespace App\Filament\Resources\Clients\Schemas;

use App\Filament\Resources\Clients\Tables\ClientsTable;
use App\Filament\Resources\Leads\LeadResource;
use App\Models\Client;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

class ClientInfolist
{
    public static function configure(Schema $schema): Schema
    {
        $tz = config('platform.timezone_display');

        return $schema->columns(3)->components([
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 2])->schema([
                Section::make('Relationship')
                    ->icon(Heroicon::OutlinedIdentification)
                    ->columns(['default' => 2, 'md' => 4])
                    ->schema([
                        TextEntry::make('client_code')->label('Client code')->copyable(),
                        TextEntry::make('onboarding_status')->label('Stage')->badge()
                            ->formatStateUsing(fn (string $state) => str($state)->lower()->headline())
                            ->color(fn (string $state) => ClientsTable::STATUS_COLORS[$state] ?? 'gray'),
                        TextEntry::make('kyc_status')->label('KYC')->badge()
                            ->color(fn (string $state) => match ($state) {
                                'verified' => 'success',
                                'rejected' => 'danger',
                                'in_review' => 'warning',
                                default => 'gray',
                            }),
                        TextEntry::make('riskProfile.risk_category')->label('Risk category')->badge()->color('info')->placeholder('Not assessed')
                            ->visible(fn (Client $record) => auth()->user()->can('viewRisk', $record)),
                        TextEntry::make('relationshipManager.user.name')->label('Relationship manager')->placeholder('Unassigned'),
                        TextEntry::make('converted_at')->label('Client since')->date('d M Y', $tz)->placeholder('—'),
                        TextEntry::make('onboarded_at')->label('Onboarding completed')->date('d M Y', $tz)->placeholder('Not yet'),
                        TextEntry::make('lead.full_name')->label('Came from lead')->placeholder('—')
                            ->url(fn (Client $record) => $record->lead_id && auth()->user()->can('view', $record->lead) ? LeadResource::getUrl('view', ['record' => $record->lead_id]) : null),
                    ]),
                Section::make('Onboarding checklist')
                    ->icon(Heroicon::OutlinedListBullet)
                    ->description('Derived from the client record — steps tick themselves off when the underlying evidence exists.')
                    ->schema([View::make('filament.clients.checklist')]),
                Section::make('Contact')
                    ->icon(Heroicon::OutlinedPhone)
                    ->columns(['default' => 1, 'md' => 3])
                    ->schema([
                        TextEntry::make('mobile')->copyable()->placeholder('—'),
                        TextEntry::make('email')->copyable()->placeholder('—'),
                        TextEntry::make('location')
                            ->state(fn (Client $record) => collect([$record->city, $record->state])->filter()->join(', ') ?: null)
                            ->placeholder('—'),
                    ]),
            ]),
            Grid::make(1)->columnSpan(['default' => 3, 'lg' => 1])->schema([
                Section::make('Risk profile')
                    ->icon(Heroicon::OutlinedChartBar)
                    ->visible(fn (Client $record) => auth()->user()->can('viewRisk', $record))
                    ->schema([View::make('filament.clients.risk-profile')]),
                Section::make('Outstanding agreements')
                    ->icon(Heroicon::OutlinedDocumentText)
                    ->schema([View::make('filament.clients.agreements')]),
            ]),
        ]);
    }
}
