<?php

namespace App\Domain\Billing;

use App\Models\Invoice;
use App\Models\Subscription;
use Filament\Notifications\Notification;

/**
 * Daily housekeeping: finished subscriptions expire, unpaid invoices are flagged overdue, and the
 * relationship manager is reminded before a service runs out. Reminders go to staff only — client
 * messaging waits for the consent-aware engine in Phase 7.
 */
final class BillingSweeper
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    /**
     * @return array{expired: int, overdue: int, reminders: int}
     */
    public function run(): array
    {
        return [
            'expired' => $this->subscriptions->expireDue(),
            'overdue' => $this->flagOverdue(),
            'reminders' => $this->remindRenewals(),
        ];
    }

    private function flagOverdue(): int
    {
        $count = 0;

        Invoice::query()
            ->withoutGlobalScopes()
            ->whereIn('status', [Invoice::ISSUED, Invoice::PARTIALLY_PAID])
            ->whereDate('due_date', '<', now())
            ->chunkById(200, function ($invoices) use (&$count): void {
                foreach ($invoices as $invoice) {
                    $invoice->forceFill(['status' => Invoice::OVERDUE])->save();
                    $count++;
                }
            });

        return $count;
    }

    private function remindRenewals(): int
    {
        $days = (array) config('billing.subscriptions.renewal_reminder_days');
        $dates = array_map(fn (int $day) => now()->addDays($day)->toDateString(), $days);
        $count = 0;

        Subscription::query()
            ->withoutGlobalScopes()
            ->where('status', Subscription::ACTIVE)
            ->whereIn('ends_on', $dates)
            ->with(['client.relationshipManager.user', 'planVersion.plan'])
            ->chunkById(200, function ($subscriptions) use (&$count): void {
                foreach ($subscriptions as $subscription) {
                    $manager = $subscription->client?->relationshipManager?->user;

                    if ($manager === null) {
                        continue;
                    }

                    Notification::make()
                        ->title('Service ending soon: '.$subscription->client->full_name)
                        ->body($subscription->planVersion->plan->name.' ends on '.$subscription->ends_on->format('d M Y').'. Talk to the client about what happens next — no automatic renewal is taken.')
                        ->warning()
                        ->sendToDatabase($manager);

                    $count++;
                }
            });

        return $count;
    }
}
