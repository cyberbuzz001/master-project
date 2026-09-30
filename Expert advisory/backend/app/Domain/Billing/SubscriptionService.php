<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Services start when a verified payment covers their invoice — never on a promise, a status change
 * or someone's say-so. An activation without a settled invoice is refused outright.
 */
final class SubscriptionService
{
    public function __construct(private readonly AuditLogger $audit, private readonly OnboardingService $onboarding) {}

    /**
     * Creates the subscription in pending_activation against an invoice line.
     */
    public function create(User $actor, Client $client, PlanVersion $version, ?Invoice $invoice = null, ?string $startsOn = null): Subscription
    {
        if (! $actor->can('subscriptions.view')) {
            throw ApiException::forbidden('You are not allowed to set up subscriptions.');
        }

        if ($version->status !== PlanVersion::PUBLISHED) {
            throw ApiException::unprocessable('PRICE_NOT_PUBLISHED', 'That plan price is not published.');
        }

        if ($client->onboarding_status === OnboardingService::CLOSED) {
            throw ApiException::unprocessable('CLIENT_CLOSED', 'This client relationship is closed.');
        }

        $outstanding = $this->onboarding->outstanding($client);

        if ($outstanding !== []) {
            throw ApiException::unprocessable('ONBOARDING_INCOMPLETE', 'Onboarding must be complete before a service is sold.', [
                'steps' => $outstanding,
            ]);
        }

        $subscription = new Subscription([
            'client_id' => $client->id,
            'plan_version_id' => $version->id,
            'invoice_id' => $invoice?->id,
            'starts_on' => $startsOn,
            'is_demo' => (bool) $client->is_demo,
        ]);
        $subscription->save();

        $this->audit->record('subscription.created', $subscription, new: [
            'plan_version_id' => $version->id, 'invoice_id' => $invoice?->id,
        ], actor: $actor);

        return $subscription;
    }

    /**
     * Activates every subscription attached to a fully paid invoice.
     *
     * @return int number of subscriptions activated
     */
    public function activateForInvoice(Invoice $invoice, ?User $actor = null): int
    {
        if (! $invoice->isSettled()) {
            return 0;
        }

        $count = 0;

        foreach ($invoice->subscriptions()->where('status', Subscription::PENDING_ACTIVATION)->get() as $subscription) {
            $this->activate($subscription, $actor, 'Invoice '.$invoice->invoice_number.' settled');
            $count++;
        }

        return $count;
    }

    public function activate(Subscription $subscription, ?User $actor = null, string $reason = ''): Subscription
    {
        if ($subscription->status === Subscription::ACTIVE) {
            return $subscription;
        }

        $invoice = $subscription->invoice;

        if (config('billing.subscriptions.activate_on_verified_payment_only')) {
            if ($invoice === null || ! $invoice->isSettled()) {
                throw ApiException::unprocessable('PAYMENT_REQUIRED', 'A service can only start once its invoice is settled by a verified payment.');
            }
        }

        $starts = $subscription->starts_on ?? Carbon::today();
        $days = (int) ($subscription->planVersion->plan->duration_days ?: Plan::CYCLES[$subscription->planVersion->plan->billing_cycle]['days'] ?? 0);

        $subscription->forceFill([
            'status' => Subscription::ACTIVE,
            'starts_on' => $starts->toDateString(),
            'ends_on' => $days > 0 ? $starts->copy()->addDays($days)->toDateString() : null,
            'activated_by' => $actor?->id,
            'activated_at' => now(),
        ])->save();

        $this->audit->record('subscription.activated', $subscription, new: [
            'starts_on' => $subscription->starts_on?->toDateString(),
            'ends_on' => $subscription->ends_on?->toDateString(),
        ], reason: $reason ?: null, actor: $actor);

        return $subscription;
    }

    /**
     * Pulls services back when the money behind them goes away (refund, reversed payment).
     */
    public function revokeForUnpaidInvoice(?Invoice $invoice, ?User $actor = null, string $reason = 'Invoice no longer settled'): int
    {
        if ($invoice === null || $invoice->isSettled()) {
            return 0;
        }

        $count = 0;

        foreach ($invoice->subscriptions()->where('status', Subscription::ACTIVE)->get() as $subscription) {
            $subscription->forceFill([
                'status' => Subscription::PAUSED,
                'cancellation_reason' => $reason,
            ])->save();

            $this->audit->record('subscription.paused', $subscription, new: ['status' => Subscription::PAUSED], reason: $reason, actor: $actor);
            $count++;
        }

        return $count;
    }

    public function cancel(User $actor, Subscription $subscription, string $reason): Subscription
    {
        if (! $actor->can('subscriptions.activate')) {
            throw ApiException::forbidden('You are not allowed to cancel subscriptions.');
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give a reason for the cancellation.');
        }

        if ($subscription->status === Subscription::CANCELLED) {
            throw ApiException::unprocessable('ALREADY_CANCELLED', 'This subscription is already cancelled.');
        }

        $subscription->forceFill([
            'status' => Subscription::CANCELLED,
            'cancellation_reason' => $reason,
            'cancelled_by' => $actor->id,
            'cancelled_at' => now(),
        ])->save();

        $this->audit->record('subscription.cancelled', $subscription, new: ['status' => Subscription::CANCELLED], reason: $reason, actor: $actor);

        return $subscription;
    }

    /**
     * Marks finished subscriptions expired. Runs from the scheduler.
     */
    public function expireDue(): int
    {
        $count = 0;

        Subscription::query()
            ->withoutGlobalScopes()
            ->where('status', Subscription::ACTIVE)
            ->whereNotNull('ends_on')
            ->whereDate('ends_on', '<', now())
            ->chunkById(200, function ($subscriptions) use (&$count): void {
                foreach ($subscriptions as $subscription) {
                    $subscription->forceFill(['status' => Subscription::EXPIRED])->save();
                    $this->audit->record('subscription.expired', $subscription, new: ['status' => Subscription::EXPIRED]);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * Sells a plan in one step: draft invoice, issue it, and queue the subscription for activation.
     *
     * @return array{invoice: Invoice, subscription: Subscription}
     */
    public function sell(User $actor, Client $client, PlanVersion $version, InvoiceService $invoices, array $attributes = []): array
    {
        return DB::transaction(function () use ($actor, $client, $version, $invoices, $attributes): array {
            $invoice = $invoices->draft($actor, $client, [['plan_version_id' => $version->id]], $attributes);
            $invoices->issue($actor, $invoice);

            $subscription = $this->create($actor, $client, $version, $invoice, $attributes['starts_on'] ?? null);

            return ['invoice' => $invoice->refresh(), 'subscription' => $subscription];
        });
    }

    /**
     * @return list<InvoiceItem>
     */
    public function linesFor(Invoice $invoice): array
    {
        return $invoice->items()->get()->all();
    }
}
