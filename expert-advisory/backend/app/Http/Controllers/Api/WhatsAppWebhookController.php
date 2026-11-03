<?php

namespace App\Http\Controllers\Api;

use App\Domain\Ai\AiWhatsAppSalesAssistant;
use App\Domain\Crm\PhoneNormalizer;
use App\Http\Controllers\Controller;
use App\Models\AiConversationMessage;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class WhatsAppWebhookController extends Controller
{
    public function __construct(
        protected AiWhatsAppSalesAssistant $assistant
    ) {
    }

    /**
     * Meta Webhook verification handshake (hub.challenge).
     */
    public function verify(Request $request): Response
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        $expectedToken = config('services.whatsapp.verify_token', env('WHATSAPP_VERIFY_TOKEN'));

        if (empty($expectedToken)) {
            Log::error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured.');
            return response('Server misconfiguration: Webhook verify token not set', 500);
        }

        if ($mode === 'subscribe' && $token === $expectedToken) {
            Log::info('[WhatsApp Webhook] Handshake verified successfully.');
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('[WhatsApp Webhook] Handshake failed: invalid verify token.');
        return response('Forbidden', 403);
    }

    /**
     * Handle incoming Meta Cloud API webhook events.
     * Verified with HMAC-SHA256 (X-Hub-Signature-256) and deduplicated against replay attacks.
     */
    public function handle(Request $request): JsonResponse
    {
        $signatureHeader = $request->header('X-Hub-Signature-256');
        $appSecret = config('services.whatsapp.app_secret', env('WHATSAPP_APP_SECRET', env('META_APP_SECRET')));

        if (app()->environment('production') || !empty($appSecret)) {
            if (empty($appSecret) || empty($signatureHeader) || !str_starts_with($signatureHeader, 'sha256=')) {
                Log::warning('[WhatsApp Webhook] Unauthorized request: Missing signature or app secret configuration.');
                return response()->json(['error' => 'Unauthorized: Missing signature'], 401);
            }

            $expectedSignature = 'sha256=' . hash_hmac('sha256', $request->getContent(), $appSecret);
            if (!hash_equals($expectedSignature, $signatureHeader)) {
                Log::warning('[WhatsApp Webhook] Unauthorized request: Signature mismatch.');
                return response()->json(['error' => 'Unauthorized: Invalid signature'], 401);
            }
        }

        $payload = $request->all();

        // Check if event is from WhatsApp Business Account
        $entry = $payload['entry'] ?? [];
        if (empty($entry)) {
            return response()->json(['status' => 'ignored'], 200);
        }

        foreach ($entry as $item) {
            $changes = $item['changes'] ?? [];
            foreach ($changes as $change) {
                $value = $change['value'] ?? [];

                // 1. Process Delivery Statuses (sent, delivered, read, failed)
                if (!empty($value['statuses'])) {
                    foreach ($value['statuses'] as $statusUpdate) {
                        $statusId = $statusUpdate['id'] ?? null;
                        $status = $statusUpdate['status'] ?? 'unknown';
                        if ($statusId) {
                            if (!Cache::add("wa_webhook_status:{$statusId}_{$status}", true, now()->addHours(24))) {
                                continue;
                            }
                        }
                        $this->handleStatusUpdate($statusUpdate);
                    }
                }

                // 2. Process Inbound Messages from Prospects
                if (!empty($value['messages'])) {
                    foreach ($value['messages'] as $message) {
                        $msgId = $message['id'] ?? null;
                        if ($msgId) {
                            if (!Cache::add("wa_webhook_msg:{$msgId}", true, now()->addHours(24))) {
                                Log::info("[WhatsApp Webhook] Duplicate message skipped: {$msgId}");
                                continue;
                            }
                        }
                        $this->handleInboundMessage($message, $value['contacts'] ?? []);
                    }
                }
            }
        }

        return response()->json(['status' => 'success'], 200);
    }
    protected function handleStatusUpdate(array $statusUpdate): void
    {
        $wamid = $statusUpdate['id'] ?? null;
        $status = $statusUpdate['status'] ?? null; // 'sent', 'delivered', 'read', 'failed'

        if (!$wamid || !$status) {
            return;
        }

        $messageRecord = AiConversationMessage::where('provider_message_id', $wamid)->first();
        if ($messageRecord) {
            $updates = ['delivery_status' => $status];
            if ($status === 'delivered') $updates['delivered_at'] = now();
            if ($status === 'read') $updates['read_at'] = now();
            if ($status === 'failed') {
                $updates['error_message'] = $statusUpdate['errors'][0]['message'] ?? 'Meta Delivery Failure';
            }
            $messageRecord->update($updates);
        }
    }

    protected function handleInboundMessage(array $message, array $contacts): void
    {
        $from = $message['from'] ?? null; // e.g. "919876543210"
        $messageId = $message['id'] ?? null;
        $type = $message['type'] ?? 'text';

        if (!$from) {
            return;
        }

        $cleanE164 = PhoneNormalizer::toE164($from) ?: ('+' . preg_replace('/\D/', '', $from));
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
        $lead = Lead::where('mobile', $cleanE164)->first();
        if (!$lead) {
            $contactName = 'Unnamed Lead';
            if (!empty($contacts[0]['profile']['name'])) {
                $contactName = trim($contacts[0]['profile']['name']);
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

        // Delegate to AI WhatsApp Sales Assistant
        $this->assistant->handleIncomingMessage($lead, $body, $messageId);
    }
}
