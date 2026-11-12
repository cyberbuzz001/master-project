<?php

namespace App\Domain\Communications;

use App\Domain\Ai\AiWhatsAppSalesAssistant;
use App\Domain\Crm\PhoneNormalizer;
use App\Models\AiConversationMessage;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\Task;
use App\Models\WebhookEvent;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class WhatsAppWebhookProcessor
{
    public function __construct(protected AiWhatsAppSalesAssistant $assistant) {}

    public function process(WebhookEvent $event): void
    {
        if ($event->event_type === 'message') {
            $this->handleInboundMessage($event->payload['message'], $event->payload['contacts'] ?? []);
        } elseif ($event->event_type === 'status') {
            $this->handleStatusUpdate($event->payload['status']);
        }
    }

    protected function handleStatusUpdate(array $status): void
    {
        $ranks = ['accepted' => 0, 'sent' => 1, 'delivered' => 2, 'read' => 3];
        $next = $status['status'];
        if (! isset($ranks[$next]) && $next !== 'failed') {
            return;
        }
        $at = Carbon::createFromTimestampUTC((int) $status['timestamp']);
        DB::transaction(function () use ($status, $ranks, $next, $at): void {
            foreach ([AiConversationMessage::class => 'delivery_status', MessageLog::class => 'status'] as $model => $field) {
                $query = $model::where('provider_message_id', $status['id']);
                if ($model === AiConversationMessage::class) {
                    $query->where('direction', 'outbound');
                }
                foreach ($query->lockForUpdate()->get() as $message) {
                    if ($message->provider_status_at && $message->provider_status_at->gt($at)) {
                        continue;
                    }
                    $current = $message->{$field};
                    if (($ranks[$current] ?? -1) > ($ranks[$next] ?? -1) && ! ($next === 'failed' && in_array($current, ['accepted', 'sent'], true))) {
                        continue;
                    }
                    $updates = [$field => $next, 'provider_status_at' => $at];
                    if ($model === AiConversationMessage::class && in_array($next, ['delivered', 'read'], true)) {
                        $updates[$next.'_at'] = $at;
                    }
                    if ($next === 'failed') {
                        $updates['error_message'] = 'Meta reported delivery failure.';
                    }
                    $message->update($updates);
                }
            }
        });
    }

    protected function handleInboundMessage(array $message, array $contacts): void
    {
        $from = $message['from'] ?? null; // e.g. "919876543210"
        $messageId = $message['id'] ?? null;
        $type = $message['type'] ?? 'text';

        if (! $from) {
            return;
        }

        $cleanE164 = PhoneNormalizer::toE164($from) ?: ('+'.preg_replace('/\D/', '', $from));
        $body = '';

        if ($type === 'text') {
            $body = $message['text']['body'] ?? '';
        } elseif ($type === 'button') {
            $body = $message['button']['text'] ?? '';
        } elseif ($type === 'interactive') {
            $interactive = $message['interactive'] ?? [];
            $body = $interactive['button_reply']['title']
                ?? $interactive['list_reply']['title']
                ?? 'Option Selected';
        } else {
            $body = "[Media message received: {$type}]";
        }

        if (empty(trim($body))) {
            return;
        }

        // Resolve or create Lead
        $lead = Lead::where('mobile', $cleanE164)->latest('id')->first();
        if (! $lead) {
            $contactName = 'Unnamed Lead';
            if (! empty($contacts[0]['profile']['name'])) {
                $contactName = mb_substr(trim($contacts[0]['profile']['name']), 0, 120);
            }

            $lead = Lead::create([
                'full_name' => $contactName,
                'mobile' => $cleanE164,
                'status' => 'NEW',
                'communication_state' => 'CONSENT_PENDING',
                'ai_score' => 20,
                'ai_grade' => 'WARM',
                'lead_score_explanation' => 'Prospect initiated direct WhatsApp inbound conversation.',
                'country' => 'India',
            ]);
        }

        $feedback = mb_strtolower(trim($body));
        if (in_array($feedback, ['good', 'need help', 'call me'], true)) {
            $trial = FreeTrial::where('lead_id', $lead->id)->where('status', 'active')->latest('id')->first();
            if ($trial) {
                $trial->update(['client_feedback' => $body]);
                if ($feedback !== 'good') {
                    Task::firstOrCreate(['taskable_type' => FreeTrial::class, 'taskable_id' => $trial->id, 'title' => 'Respond to feedback for '.$trial->trial_code], [
                        'assignee_employee_id' => $trial->employee_id, 'description' => 'Client feedback: '.$body, 'priority' => 'high', 'status' => 'open', 'due_at' => now(),
                    ]);
                }
            }
        }

        // Delegate to AI WhatsApp Sales Assistant
        $this->assistant->handleIncomingMessage($lead, $body, $messageId, Carbon::createFromTimestampUTC((int) $message['timestamp'])->min(now()));
    }
}
