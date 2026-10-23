<?php

namespace App\Domain\Communications;

use App\Models\AiConversation;
use App\Models\AiConversationMessage;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\MessageTemplate;
use App\Models\SuppressionRecord;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    /**
     * Send free-form WhatsApp message within 24h customer-service messaging window.
     *
     * @param string $to Phone number (10-digit or E.164)
     * @param string $text Message content
     * @param Lead|null $lead
     * @param AiConversation|null $conversation
     * @return array<string, mixed>
     */
    public function sendText(string $to, string $text, ?Lead $lead = null, ?AiConversation $conversation = null): array
    {
        $cleanPhone = $this->normalizePhone($to);

        // 1. Check Centralized Suppression
        if (SuppressionRecord::isSuppressed($cleanPhone, null, 'whatsapp')) {
            Log::info("[WhatsApp] Dispatch refused: {$cleanPhone} is on suppression list.");
            return [
                'success' => false,
                'status' => 'suppressed',
                'error' => 'Contact is suppressed (opted out or DND).',
            ];
        }

        // 2. Check Quiet Hours (9:00 AM to 8:00 PM IST)
        if ($this->isQuietHoursNow()) {
            Log::info("[WhatsApp] Dispatch deferred: Currently quiet hours (outside 9am-8pm IST).");
            return [
                'success' => false,
                'status' => 'quiet_hours_deferred',
                'error' => 'Promotional outreach is restricted outside 9:00 AM to 8:00 PM IST under TRAI/SEBI guidelines.',
            ];
        }

        // 3. Check 24-Hour Messaging Window for Free-form Text
        if ($lead && !$this->isInsideCustomerServiceWindow($lead)) {
            Log::warning("[WhatsApp] 24h session window expired for lead #{$lead->id}. Free-form text blocked; pre-approved template required.");
            return [
                'success' => false,
                'status' => 'window_expired',
                'error' => 'Customer service 24-hour window closed. Only Meta-approved templates may initiate conversation.',
            ];
        }

        // 4. Retrieve Meta Cloud API Credentials
        $token = env('WHATSAPP_ACCESS_TOKEN') ?: (class_exists(SystemSetting::class) ? SystemSetting::where('key', 'whatsapp_access_token')->value('value') : null);
        $phoneId = env('WHATSAPP_PHONE_NUMBER_ID') ?: (class_exists(SystemSetting::class) ? SystemSetting::where('key', 'whatsapp_phone_number_id')->value('value') : null);

        $providerMessageId = null;
        $status = 'sent';
        $errorMessage = null;

        if (!empty($token) && !empty($phoneId)) {
            // Live Meta Cloud Graph API v17.0+
            $url = "https://graph.facebook.com/v17.0/{$phoneId}/messages";
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => ltrim($cleanPhone, '+'),
                'type' => 'text',
                'text' => [
                    'preview_url' => false,
                    'body' => $text,
                ],
            ];

            try {
                $response = Http::withToken($token)->timeout(20)->post($url, $payload);
                if ($response->successful()) {
                    $providerMessageId = $response->json('messages.0.id');
                    $status = 'sent';
                } else {
                    $status = 'failed';
                    $errorMessage = 'Meta API Error: ' . $response->json('error.message', $response->body());
                    Log::error('[WhatsApp] Meta dispatch error:', ['response' => $response->json()]);
                }
            } catch (Exception $e) {
                $status = 'failed';
                $errorMessage = 'Meta API Exception: ' . $e->getMessage();
                Log::error('[WhatsApp] Meta connection error:', ['error' => $e->getMessage()]);
            }
        } else {
            // Graceful Mock/Sandbox Dispatch (for development/staging environments)
            $providerMessageId = 'mock_wamid_' . bin2hex(random_bytes(10));
            $status = 'sent';
            Log::info("[WhatsApp Mock Mode] Dispatched to {$cleanPhone}: {$text}");
        }

        // 5. Log Message in Database
        if ($conversation && $lead) {
            AiConversationMessage::create([
                'conversation_id' => $conversation->id,
                'lead_id' => $lead->id,
                'direction' => 'outbound',
                'sender_type' => 'ai_assistant',
                'message_text' => $text,
                'provider_message_id' => $providerMessageId,
                'delivery_status' => $status,
                'error_message' => $errorMessage,
                'sent_at' => $status === 'sent' ? now() : null,
            ]);

            $conversation->increment('total_messages');
            $conversation->update(['last_activity_at' => now()]);
        }

        return [
            'success' => $status === 'sent',
            'status' => $status,
            'provider_message_id' => $providerMessageId,
            'error' => $errorMessage,
        ];
    }

    /**
     * Send pre-approved WhatsApp Template with dynamic parameters.
     *
     * @param string $to
     * @param string $templateName
     * @param array<int, string> $parameters
     * @param Lead|null $lead
     * @param string $languageCode
     * @return array<string, mixed>
     */
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        ?Lead $lead = null,
        string $languageCode = 'en'
    ): array {
        $cleanPhone = $this->normalizePhone($to);

        // 1. Suppression Check
        if (SuppressionRecord::isSuppressed($cleanPhone, null, 'whatsapp')) {
            return [
                'success' => false,
                'status' => 'suppressed',
                'error' => 'Contact is suppressed.',
            ];
        }

        // 2. Consent Check for Leads
        if ($lead && in_array($lead->communication_state, ['OPTED_OUT', 'DO_NOT_CONTACT', 'CHANNEL_RESTRICTED'])) {
            return [
                'success' => false,
                'status' => 'consent_refused',
                'error' => "Lead communication state is {$lead->communication_state}. Template dispatch refused.",
            ];
        }

        // 3. Quiet Hours Check
        if ($this->isQuietHoursNow()) {
            return [
                'success' => false,
                'status' => 'quiet_hours_deferred',
                'error' => 'Promotional messaging restricted during quiet hours (8pm-9am IST).',
            ];
        }

        $token = env('WHATSAPP_ACCESS_TOKEN');
        $phoneId = env('WHATSAPP_PHONE_NUMBER_ID');

        $providerMessageId = null;
        $status = 'sent';
        $errorMessage = null;

        if (!empty($token) && !empty($phoneId)) {
            $components = [];
            if (!empty($parameters)) {
                $bodyParams = [];
                foreach ($parameters as $p) {
                    $bodyParams[] = ['type' => 'text', 'text' => (string) $p];
                }
                $components[] = [
                    'type' => 'body',
                    'parameters' => $bodyParams,
                ];
            }

            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => ltrim($cleanPhone, '+'),
                'type' => 'template',
                'template' => [
                    'name' => $templateName,
                    'language' => ['code' => $languageCode],
                    'components' => $components,
                ],
            ];

            try {
                $url = "https://graph.facebook.com/v17.0/{$phoneId}/messages";
                $response = Http::withToken($token)->timeout(20)->post($url, $payload);
                if ($response->successful()) {
                    $providerMessageId = $response->json('messages.0.id');
                    $status = 'sent';
                } else {
                    $status = 'failed';
                    $errorMessage = 'Meta Template Error: ' . $response->json('error.message', $response->body());
                    Log::error('[WhatsApp Template] Meta error:', ['response' => $response->json()]);
                }
            } catch (Exception $e) {
                $status = 'failed';
                $errorMessage = 'Meta Template Exception: ' . $e->getMessage();
            }
        } else {
            // Mock mode
            $providerMessageId = 'mock_tpl_wamid_' . bin2hex(random_bytes(10));
            $status = 'sent';
            Log::info("[WhatsApp Mock Mode] Dispatched Template {$templateName} to {$cleanPhone}");
        }

        // Log to message_logs
        MessageLog::create([
            'channel' => 'whatsapp',
            'recipient_type' => 'lead',
            'recipient_id' => $lead?->id,
            'recipient_phone' => $cleanPhone,
            'rendered_subject' => "Template: {$templateName}",
            'rendered_body' => "Template [{$templateName}] params: " . implode(', ', $parameters),
            'consent_verified' => true,
            'status' => $status,
            'provider_message_id' => $providerMessageId,
            'sent_at' => $status === 'sent' ? now() : null,
            'error_message' => $errorMessage,
        ]);

        return [
            'success' => $status === 'sent',
            'status' => $status,
            'provider_message_id' => $providerMessageId,
            'error' => $errorMessage,
        ];
    }

    /**
     * Check if customer-service 24h messaging window is currently open.
     */
    public function isInsideCustomerServiceWindow(Lead $lead): bool
    {
        if (empty($lead->last_whatsapp_received_at)) {
            return false;
        }

        return $lead->last_whatsapp_received_at->diffInHours(now()) <= 24;
    }

    /**
     * Check if current time in IST is within quiet hours (8:00 PM to 9:00 AM IST).
     */
    public function isQuietHoursNow(): bool
    {
        $nowIst = Carbon::now('Asia/Kolkata');
        $hour = (int) $nowIst->format('G'); // 0 to 23

        // Quiet hours: before 9 AM or after 8 PM (20:00)
        return $hour < 9 || $hour >= 20;
    }

    /**
     * Normalize Indian and international phone numbers to E.164.
     */
    public function normalizePhone(string $raw): string
    {
        $digits = preg_replace('/\D/', '', $raw);
        if (strlen($digits) === 10 && preg_match('/^[6-9]/', $digits)) {
            return '+91' . $digits;
        }
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            return '+' . $digits;
        }
        return str_starts_with(trim($raw), '+') ? '+' . $digits : '+91' . substr($digits, -10);
    }
}
