<?php

namespace App\Domain\Communications;

use App\Domain\Audit\AuditLogger;
use App\Models\AiConversation;
use App\Models\AiConversationMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class WhatsAppInboxService
{
    public function __construct(private WhatsAppService $gateway, private AuditLogger $audit) {}

    private function authorize(User $actor, AiConversation $conversation): void
    {
        Gate::forUser($actor)->authorize('messages.send_approved');
        Gate::forUser($actor)->authorize('update', $conversation->lead);
    }

    public function takeover(User $actor, AiConversation $conversation, bool $pause, string $reason): void
    {
        $this->authorize($actor, $conversation);
        Validator::make(['reason' => $reason], ['reason' => 'required|string|min:10|max:500'])->validate();
        DB::transaction(function () use ($actor, $conversation, $pause, $reason): void {
            $conversation->lead->update(['is_ai_paused' => $pause]);
            $conversation->update(['is_paused_for_human' => $pause, 'paused_by_user_id' => $pause ? $actor->id : null]);
            $this->audit->record($pause ? 'whatsapp.human_takeover' : 'whatsapp.automation_resumed', $conversation, reason: $reason, actor: $actor);
        });
    }

    public function reply(User $actor, AiConversation $conversation, string $text, string $requestKey): AiConversationMessage
    {
        $this->authorize($actor, $conversation);
        Validator::make(['text' => $text, 'request_key' => $requestKey], ['text' => 'required|string|max:4096', 'request_key' => 'required|uuid'])->validate();
        $message = DB::transaction(function () use ($actor, $conversation, $text, $requestKey): AiConversationMessage {
            $conversation = AiConversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $existing = AiConversationMessage::where('request_key', $requestKey)->first();
            if ($existing) {
                abort_unless($existing->conversation_id === $conversation->id && $existing->sender_user_id === $actor->id, 403);

                return $existing;
            }
            $conversation->lead->update(['is_ai_paused' => true]);
            $conversation->update(['is_paused_for_human' => true, 'paused_by_user_id' => $actor->id, 'last_activity_at' => now()]);
            $message = AiConversationMessage::create(['request_key' => $requestKey, 'conversation_id' => $conversation->id, 'lead_id' => $conversation->lead_id, 'direction' => 'outbound', 'sender_type' => 'human_agent', 'sender_user_id' => $actor->id, 'message_text' => $text, 'delivery_status' => 'processing']);
            $conversation->increment('total_messages');
            $this->audit->record('whatsapp.human_reply_requested', $message, new: ['body_sha256' => hash('sha256', $text)], actor: $actor);

            return $message;
        });
        if (! $message->wasRecentlyCreated) {
            return $message;
        }
        try {
            $result = $this->gateway->sendText($conversation->lead->mobile, $text, $conversation->lead->fresh());
        } catch (\Throwable $exception) {
            report($exception);
            $result = ['success' => false, 'status' => 'review_required', 'error' => 'Outcome unknown; reconcile before retrying.'];
        }
        $message->update(['delivery_status' => $result['status'], 'provider_message_id' => $result['provider_message_id'] ?? null, 'error_message' => $result['error'] ?? null, 'sent_at' => $result['success'] ? now() : null]);

        return $message->fresh();
    }
}
