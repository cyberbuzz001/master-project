<?php

namespace App\Domain\Crm;

use App\Models\Followup;
use App\Models\LeadActivity;
use Filament\Notifications\Notification;

/**
 * Scheduled sweep: reminds owners shortly before a follow-up is due and marks overdue ones as missed.
 */
final class FollowupMonitor
{
    public const REMIND_MINUTES_BEFORE = 15;

    public const MISSED_AFTER_MINUTES = 120;

    /**
     * @return array{reminded: int, missed: int}
     */
    public function sweep(): array
    {
        $reminded = 0;
        $missed = 0;

        Followup::query()->withoutGlobalScopes()
            ->with(['lead:id,full_name,uuid', 'employee.user'])
            ->where('status', Followup::PENDING)
            ->whereNull('reminded_at')
            ->whereBetween('due_at', [now()->subMinutes(self::MISSED_AFTER_MINUTES), now()->addMinutes(self::REMIND_MINUTES_BEFORE)])
            ->chunkById(200, function ($followups) use (&$reminded): void {
                foreach ($followups as $followup) {
                    $user = $followup->employee?->user;
                    if ($user !== null) {
                        Notification::make()
                            ->title('Follow-up due: '.$followup->lead?->full_name)
                            ->body(Followup::CHANNELS[$followup->channel].' at '.$followup->due_at->timezone(config('platform.timezone_display'))->format('h:i A'))
                            ->icon('heroicon-o-bell-alert')
                            ->warning()
                            ->sendToDatabase($user);
                    }
                    $followup->forceFill(['reminded_at' => now()])->save();
                    $reminded++;
                }
            });

        Followup::query()->withoutGlobalScopes()
            ->with(['lead:id,full_name,team_leader_employee_id', 'lead.teamLeader.user', 'employee.user'])
            ->where('status', Followup::PENDING)
            ->where('due_at', '<', now()->subMinutes(self::MISSED_AFTER_MINUTES))
            ->chunkById(200, function ($followups) use (&$missed): void {
                foreach ($followups as $followup) {
                    $followup->forceFill(['status' => Followup::MISSED])->save();

                    LeadActivity::create([
                        'lead_id' => $followup->lead_id,
                        'type' => 'followup_missed',
                        'actor_user_id' => null,
                        'summary' => 'Follow-up missed (was due '.$followup->due_at->timezone(config('platform.timezone_display'))->format('d M, h:i A').')',
                        'details' => ['followup_id' => $followup->id],
                        'occurred_at' => now(),
                    ]);

                    $recipients = collect([$followup->employee?->user, $followup->lead?->teamLeader?->user])->filter()->unique('id');
                    foreach ($recipients as $user) {
                        Notification::make()
                            ->title('Missed follow-up: '.$followup->lead?->full_name)
                            ->danger()
                            ->sendToDatabase($user);
                    }
                    $missed++;
                }
            });

        return ['reminded' => $reminded, 'missed' => $missed];
    }
}
