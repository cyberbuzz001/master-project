<?php

namespace App\Jobs;

use App\Domain\Communications\WhatsAppWebhookProcessor;
use App\Models\WebhookEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessWhatsAppWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 60;

    public function __construct(public int $eventId) {}

    public function handle(WhatsAppWebhookProcessor $processor): void
    {
        $claimed = WebhookEvent::whereKey($this->eventId)->where('status', WebhookEvent::RECEIVED)->update(['status' => 'processing', 'processing_started_at' => now()]);
        if (! $claimed) {
            return;
        }
        $event = WebhookEvent::findOrFail($this->eventId);
        try {
            $processor->process($event);
            $event->forceFill(['status' => WebhookEvent::PROCESSED, 'processed_at' => now()])->save();
        } catch (Throwable $exception) {
            $event->forceFill(['status' => 'review_required', 'result' => 'Processing failed; reconcile any outbound side effects before retry.'])->save();
            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        WebhookEvent::whereKey($this->eventId)->where('status', 'processing')->update(['status' => 'review_required', 'result' => 'Worker stopped; reconcile before retry.']);
    }
}
