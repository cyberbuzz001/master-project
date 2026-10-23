<?php

namespace App\Filament\Widgets;

use App\Models\Lead;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class AiAutomationStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 2;

    protected ?string $pollingInterval = '60s';

    public static function canView(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    protected function getStats(): array
    {
        $user = auth()->user();
        $leads = fn () => Lead::query()->visibleTo($user);

        $consentVerified = $leads()->whereIn('communication_state', ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])->count();
        $activeConversations = $leads()->whereNotNull('last_whatsapp_received_at')->count();
        $demoAppointments = $leads()->where(function ($q) {
            $q->whereNotNull('demo_requested_at')
              ->orWhereNotNull('appointment_requested_at')
              ->orWhereIn('ai_conversation_state', ['DEMO_REQUESTED', 'DEMO_BOOKED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_BOOKED']);
        })->count();
        $humanTakeover = $leads()->where('is_ai_paused', true)->count();

        return [
            Stat::make('WhatsApp Eligible Leads', $consentVerified)
                ->description('Statutory consent verified')
                ->descriptionIcon('heroicon-m-check-badge')
                ->color('success'),
            Stat::make('Active WA Conversations', $activeConversations)
                ->description('Two-way lead engagement')
                ->descriptionIcon('heroicon-m-chat-bubble-left-right')
                ->color('primary'),
            Stat::make('Demos & Appointments', $demoAppointments)
                ->description('AI high-intent conversions')
                ->descriptionIcon('heroicon-m-calendar')
                ->color('warning'),
            Stat::make('Human Takeover Active', $humanTakeover)
                ->description('AI paused for manual handling')
                ->descriptionIcon('heroicon-m-hand-raised')
                ->color($humanTakeover > 0 ? 'warning' : 'gray'),
        ];
    }
}
