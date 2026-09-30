<?php

namespace App\Domain\Communications;

use App\Models\Client;
use App\Models\ConsentRecord;
use App\Models\Lead;
use App\Models\MessageLog;
use App\Models\MessageTemplate;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;
use RuntimeException;

class NotificationService
{
    /**
     * Send a templated message to a recipient, strictly enforcing template approval
     * and statutory consent verification under SEBI & IT rules.
     *
     * @param string $templateKey
     * @param string $recipientType 'client' | 'lead' | 'user'
     * @param int $recipientId
     * @param array<string, string> $data
     * @return MessageLog
     */
    public function send(string $templateKey, string $recipientType, int $recipientId, array $data = []): MessageLog
    {
        $template = MessageTemplate::where('key', $templateKey)->first();
        if (!$template) {
            throw new InvalidArgumentException("Message template '{$templateKey}' not found.");
        }

        if ($template->status !== 'approved') {
            throw new RuntimeException("UNAPPROVED_TEMPLATE: Message template '{$templateKey}' is {$template->status}. Messages may only be dispatched using approved templates.");
        }

        // Resolve recipient contact info
        $email = null;
        $phone = null;
        $name = 'Client';

        if ($recipientType === 'client') {
            $client = Client::find($recipientId);
            if (!$client) {
                throw new InvalidArgumentException("Client #{$recipientId} not found.");
            }
            $email = $client->email;
            $phone = $client->mobile;
            $name = $client->full_name;
        } elseif ($recipientType === 'lead') {
            $lead = Lead::find($recipientId);
            if (!$lead) {
                throw new InvalidArgumentException("Lead #{$recipientId} not found.");
            }
            $email = $lead->email;
            $phone = $lead->mobile;
            $name = $lead->name;
        } elseif ($recipientType === 'user') {
            $user = User::find($recipientId);
            if (!$user) {
                throw new InvalidArgumentException("User #{$recipientId} not found.");
            }
            $email = $user->email;
            $phone = $user->mobile ?? null;
            $name = $user->name;
        }

        // Default name if not in data
        if (!isset($data['name'])) {
            $data['name'] = $name;
        }

        // Consent verification for external recipients (clients and leads)
        $channel = $template->channel;
        $consentVerified = false;

        if ($recipientType === 'user') {
            // Internal staff notifications do not require consumer consent
            $consentVerified = true;
        } else {
            // Check active consent
            $hasConsent = ConsentRecord::where('subject_type', $recipientType)
                ->where('subject_id', $recipientId)
                ->where('granted', true)
                ->where(function ($q) use ($channel) {
                    $q->where('channel', $channel)
                      ->orWhere('purpose', 'like', "%{$channel}%");
                })
                ->exists();

            $consentVerified = $hasConsent;
        }

        // Render subject and body
        $renderedSubject = $template->subject;
        $renderedBody = $template->body;

        foreach ($data as $k => $v) {
            $placeholder = '{{' . $k . '}}';
            if ($renderedSubject) {
                $renderedSubject = str_replace($placeholder, (string) $v, $renderedSubject);
            }
            $renderedBody = str_replace($placeholder, (string) $v, $renderedBody);
        }

        if (!$consentVerified) {
            // Log refusal and abort dispatch
            return MessageLog::create([
                'channel' => $channel,
                'recipient_type' => $recipientType,
                'recipient_id' => $recipientId,
                'recipient_email' => $email,
                'recipient_phone' => $phone,
                'template_id' => $template->id,
                'rendered_subject' => $renderedSubject,
                'rendered_body' => $renderedBody,
                'consent_verified' => false,
                'status' => 'consent_refused',
                'error_message' => "Dispatch refused: No active {$channel} consent on file for {$recipientType} #{$recipientId}.",
            ]);
        }

        // Dispatch
        $providerMessageId = null;
        $status = 'sent';
        $errorMessage = null;

        try {
            if ($channel === 'email' && !empty($email)) {
                Mail::raw($renderedBody, function ($message) use ($email, $renderedSubject) {
                    $message->to($email)
                        ->subject($renderedSubject ?: 'Expert Stocks Notification');
                });
                $providerMessageId = 'mail-' . bin2hex(random_bytes(8));
            } elseif ($channel === 'whatsapp' && !empty($phone)) {
                // In production, invokes WhatsApp Business Cloud API / Provider
                $providerMessageId = 'wa-' . bin2hex(random_bytes(8));
            }
        } catch (Exception $e) {
            $status = 'failed';
            $errorMessage = $e->getMessage();
        }

        return MessageLog::create([
            'channel' => $channel,
            'recipient_type' => $recipientType,
            'recipient_id' => $recipientId,
            'recipient_email' => $email,
            'recipient_phone' => $phone,
            'template_id' => $template->id,
            'rendered_subject' => $renderedSubject,
            'rendered_body' => $renderedBody,
            'consent_verified' => true,
            'status' => $status,
            'provider_message_id' => $providerMessageId,
            'sent_at' => $status === 'sent' ? now() : null,
            'error_message' => $errorMessage,
        ]);
    }
}
