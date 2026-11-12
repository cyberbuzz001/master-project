<?php

namespace App\Domain\Communications;

use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Crm\PhoneNormalizer;
use App\Models\AiConversation;
use App\Models\AiConversationMessage;
use App\Models\Client;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\MessageTemplate;
use App\Models\SuppressionRecord;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class WhatsAppService
{
    public function sendText(string $to, string $text, ?Lead $lead = null, ?AiConversation $conversation = null): array
    {
        $phone = PhoneNormalizer::toE164($to);
        if (! $lead || ! $phone || $phone !== PhoneNormalizer::toE164($lead->mobile) || ! $this->isInsideCustomerServiceWindow($lead)) {
            return $this->refused('window_expired', 'A verified inbound customer-service window is required.');
        }
        if ($this->blocked($lead, $phone) || mb_strlen($text) > 4096 || trim($text) === '') {
            return $this->refused('suppressed', 'Recipient is suppressed or message is invalid.');
        }
        $result = $this->dispatch(['messaging_product' => 'whatsapp', 'to' => ltrim($phone, '+'), 'type' => 'text', 'text' => ['preview_url' => false, 'body' => $text]]);
        if ($conversation) {
            AiConversationMessage::create([
                'conversation_id' => $conversation->id, 'lead_id' => $lead->id, 'direction' => 'outbound', 'sender_type' => 'ai_assistant',
                'message_text' => $text, 'provider_message_id' => $result['provider_message_id'] ?? null,
                'delivery_status' => $result['status'], 'error_message' => $result['error'] ?? null,
                'sent_at' => $result['success'] ? now() : null,
            ]);
            $conversation->increment('total_messages');
            $conversation->update(['last_activity_at' => now()]);
        }

        return $result;
    }

    public function sendTemplate(string $to, string $templateName, array $parameters = [], ?Lead $lead = null, string $languageCode = 'en'): array
    {
        if (! $lead || PhoneNormalizer::toE164($to) !== PhoneNormalizer::toE164($lead->mobile)) {
            return $this->refused('recipient_required', 'A matching CRM recipient is required.');
        }
        $template = MessageTemplate::query()->where('channel', 'whatsapp')
            ->where(fn ($q) => $q->where('key', $templateName)->orWhere('provider_template_name', $templateName))->first();
        $result = $template ? $this->sendForRecipient($template, 'lead', $lead->id, $parameters) : $this->refused('template_unapproved', 'Approved template mapping not found.');
        MessageLog::create([
            'channel' => 'whatsapp', 'recipient_type' => 'lead', 'recipient_id' => $lead->id, 'recipient_phone' => $lead->mobile,
            'template_id' => $template?->id, 'rendered_subject' => 'Template: '.$templateName, 'rendered_body' => json_encode($parameters),
            'consent_verified' => app(ConsentRecorder::class)->hasConsent('lead', $lead->id, 'whatsapp'),
            'status' => $result['status'], 'provider_message_id' => $result['provider_message_id'] ?? null,
            'sent_at' => $result['success'] ? now() : null, 'error_message' => $result['error'] ?? null,
        ]);

        return $result;
    }

    public function sendForRecipient(MessageTemplate $template, string $recipientType, int $recipientId, array $parameters): array
    {
        $recipient = match ($recipientType) {
            'lead' => Lead::find($recipientId), 'client' => Client::find($recipientId), default => null
        };
        $phone = $recipient ? PhoneNormalizer::toE164($recipient->mobile) : null;
        if (! $recipient || ! $phone || $this->blocked($recipient, $phone)) {
            return $this->refused('suppressed', 'Recipient is missing, invalid or suppressed.');
        }
        $consents = app(ConsentRecorder::class);
        if (! $consents->hasConsent($recipientType, $recipientId, 'whatsapp') || ($template->purpose && ! $consents->hasConsent($recipientType, $recipientId, $template->purpose))) {
            return $this->refused('consent_refused', 'Active channel and purpose consent are required.');
        }
        if (! $template->isApproved() || $template->provider_status !== 'APPROVED' || ! $template->provider_template_name || ! $template->provider_checked_at || $template->provider_checked_at->lt(now()->subDay())) {
            return $this->refused('template_unapproved', 'Template approval must be current in the connected Meta account.');
        }
        if (count($parameters) !== count($template->variables ?? []) || collect($parameters)->contains(fn ($p) => ! is_scalar($p) || mb_strlen((string) $p) > 1024)) {
            return $this->refused('invalid_parameters', 'Template variables do not match the approved mapping.');
        }
        if ($this->isQuietHoursNow()) {
            return $this->refused('quiet_hours_deferred', 'Outside configured outreach hours.');
        }
        $components = $parameters ? [['type' => 'body', 'parameters' => array_map(fn ($p) => ['type' => 'text', 'text' => (string) $p], array_values($parameters))]] : [];
        if (in_array($template->provider_header_format, ['DOCUMENT', 'IMAGE'], true)) {
            if (! $template->provider_media_id) {
                return $this->refused('media_required', 'Approved media is required for this template.');
            }
            $type = strtolower($template->provider_header_format);
            array_unshift($components, ['type' => 'header', 'parameters' => [['type' => $type, $type => ['id' => $template->provider_media_id]]]]);
        }

        return $this->dispatch(['messaging_product' => 'whatsapp', 'to' => ltrim($phone, '+'), 'type' => 'template', 'template' => [
            'name' => $template->provider_template_name, 'language' => ['code' => $template->language_code], 'components' => $components,
        ]]);
    }

    private function blocked(Lead|Client $recipient, string $phone): bool
    {
        return SuppressionRecord::isSuppressed($phone, $recipient->email, 'whatsapp')
            || ($recipient instanceof Lead && in_array($recipient->communication_state, ['OPTED_OUT', 'DO_NOT_CONTACT', 'CHANNEL_RESTRICTED'], true));
    }

    private function dispatch(array $payload): array
    {
        $token = config('services.whatsapp.access_token');
        $phoneId = config('services.whatsapp.phone_number_id');
        $version = config('services.whatsapp.graph_version');
        if (! $token || ! $phoneId || ! preg_match('/^v[0-9]+\.0$/', (string) $version) || ! ctype_digit((string) $phoneId)) {
            return $this->refused('provider_not_configured', 'WhatsApp provider is not configured.');
        }
        try {
            $response = Http::withToken($token)->connectTimeout(5)->timeout(20)->post("https://graph.facebook.com/{$version}/{$phoneId}/messages", $payload);
        } catch (ConnectionException) {
            return $this->refused('review_required', 'Provider outcome is unknown. Reconcile before retrying.');
        }
        $id = $response->json('messages.0.id');
        if ($response->successful() && is_string($id) && $id !== '') {
            return ['success' => true, 'status' => 'accepted', 'provider_message_id' => $id, 'error' => null];
        }
        if ($response->status() === 429) {
            return [...$this->refused('rate_limited', 'Provider rate limit reached.'), 'retry_after' => max(1, min(3600, (int) $response->header('Retry-After', 60)))];
        }

        return $this->refused($response->serverError() || $response->successful() ? 'review_required' : 'failed', 'Provider did not acknowledge this message.');
    }

    private function refused(string $status, string $error): array
    {
        return ['success' => false, 'status' => $status, 'provider_message_id' => null, 'error' => $error];
    }

    public function isInsideCustomerServiceWindow(Lead $lead): bool
    {
        $received = $lead->last_whatsapp_received_at;

        return $received && $received->lte(now()) && $received->gt(now()->subHours(24));
    }

    public function isQuietHoursNow(): bool
    {
        $hour = (int) Carbon::now('Asia/Kolkata')->format('G');

        return $hour < (int) config('services.whatsapp.outreach_start_hour', 9) || $hour >= (int) config('services.whatsapp.outreach_end_hour', 20);
    }

    public function normalizePhone(string $raw): string
    {
        return PhoneNormalizer::toE164($raw) ?? '';
    }
}
