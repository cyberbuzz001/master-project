<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessWhatsAppWebhook;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request): Response
    {
        $expected = config('services.whatsapp.verify_token');
        if (! $expected) {
            return response('Webhook is not configured.', 503);
        }
        $actual = (string) $request->query('hub_mode');
        $token = (string) $request->query('hub_verify_token');
        if ($actual !== 'subscribe' || ! $token || ! hash_equals($expected, $token) || ! $request->has('hub_challenge')) {
            return response('Forbidden', 403);
        }

        return response((string) $request->query('hub_challenge'), 200)->header('Content-Type', 'text/plain');
    }

    public function handle(Request $request): JsonResponse
    {
        $rawContent = $request->getContent();
        \Illuminate\Support\Facades\Log::info('WHATSAPP WEBHOOK POST RECEIVED', [
            'raw_payload' => json_decode($rawContent, true),
            'signature' => $request->header('X-Hub-Signature-256'),
        ]);

        $secret = config('services.whatsapp.app_secret');
        $waba = config('services.whatsapp.business_account_id');
        $phone = config('services.whatsapp.phone_number_id');
        if (! $secret || ! $waba || ! $phone || (app()->isProduction() && config('queue.default') === 'sync')) {
            return response()->json(['success' => false, 'message' => 'Webhook processing is not configured.'], 503);
        }
        $signature = (string) $request->header('X-Hub-Signature-256');
        if (! preg_match('/^sha256=[a-f0-9]{64}$/', $signature) || ! hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
            return response()->json(['success' => false, 'message' => 'Invalid signature.'], 401);
        }
        $payload = $request->validate([
            'object' => ['required', 'in:whatsapp_business_account'],
            'entry' => ['required', 'array', 'max:20'], 'entry.*.id' => ['required', 'string'],
            'entry.*.changes' => ['required', 'array', 'max:20'], 'entry.*.changes.*.value' => ['required', 'array'],
            'entry.*.changes.*.value.metadata.phone_number_id' => ['required', 'string'],
            'entry.*.changes.*.value.messages' => ['sometimes', 'array', 'max:100'],
            'entry.*.changes.*.value.messages.*.id' => ['required', 'string', 'max:255'],
            'entry.*.changes.*.value.messages.*.from' => ['required', 'regex:/^[0-9]{8,15}$/'],
            'entry.*.changes.*.value.messages.*.timestamp' => ['required', 'integer', 'min:1'],
            'entry.*.changes.*.value.messages.*.type' => ['required', 'string', 'max:32'],
            'entry.*.changes.*.value.messages.*.text.body' => ['sometimes', 'string', 'max:4096'],
            'entry.*.changes.*.value.messages.*.button.text' => ['sometimes', 'string', 'max:1000'],
            'entry.*.changes.*.value.messages.*.interactive.button_reply.title' => ['sometimes', 'string', 'max:1000'],
            'entry.*.changes.*.value.messages.*.interactive.list_reply.title' => ['sometimes', 'string', 'max:1000'],
            'entry.*.changes.*.value.contacts' => ['sometimes', 'array', 'max:100'],
            'entry.*.changes.*.value.contacts.*.wa_id' => ['sometimes', 'string'],
            'entry.*.changes.*.value.contacts.*.profile.name' => ['sometimes', 'string'],
            'entry.*.changes.*.value.statuses' => ['sometimes', 'array', 'max:100'],
            'entry.*.changes.*.value.statuses.*.id' => ['required', 'string', 'max:255'],
            'entry.*.changes.*.value.statuses.*.status' => ['required', 'string'],
            'entry.*.changes.*.value.statuses.*.timestamp' => ['required', 'integer', 'min:1'],
        ]);
        $events = [];
        foreach ($payload['entry'] as $entry) {
            \Illuminate\Support\Facades\Log::info('WHATSAPP WEBHOOK ENTRY', [
                'entry_id' => $entry['id'] ?? null,
                'expected_waba' => $waba,
                'changes_count' => count($entry['changes'] ?? []),
            ]);
            if ((string) $entry['id'] !== (string) $waba) {
                \Illuminate\Support\Facades\Log::warning('WHATSAPP WEBHOOK WABA MISMATCH - verifying by phone_number_id and HMAC signature', [
                    'received_entry_id' => $entry['id'],
                    'configured_waba' => $waba,
                ]);
            }
            foreach ($entry['changes'] as $change) {
                $value = $change['value'];
                \Illuminate\Support\Facades\Log::info('WHATSAPP WEBHOOK CHANGE', [
                    'phone_number_id' => $value['metadata']['phone_number_id'] ?? null,
                    'configured_phone' => $phone,
                ]);
                if ((string) $value['metadata']['phone_number_id'] !== (string) $phone) {
                    \Illuminate\Support\Facades\Log::warning('WHATSAPP WEBHOOK PHONE MISMATCH', [
                        'received_phone_id' => $value['metadata']['phone_number_id'] ?? null,
                        'configured_phone' => $phone,
                    ]);
                    return response()->json(['success' => false], 403);
                }
                foreach ($value['messages'] ?? [] as $message) {
                    $events[] = ['event_id' => hash('sha256', 'message:'.$message['id']), 'event_type' => 'message', 'payload' => ['message' => $message, 'contacts' => $value['contacts'] ?? []]];
                }
                foreach ($value['statuses'] ?? [] as $status) {
                    $events[] = ['event_id' => hash('sha256', 'status:'.$status['id'].':'.$status['status'].':'.$status['timestamp']), 'event_type' => 'status', 'payload' => ['status' => $status]];
                }
            }
        }
        DB::transaction(function () use ($events): void {
            foreach ($events as $data) {
                $event = WebhookEvent::firstOrCreate(['provider' => 'whatsapp', 'event_id' => $data['event_id']], array_merge($data, ['signature_valid' => true]));
                // Re-enqueue a received event if a previous queue submission failed. The job's
                // atomic claim prevents concurrent deliveries from processing the event twice.
                if ($event->status === WebhookEvent::RECEIVED) {
                    ProcessWhatsAppWebhook::dispatch($event->id)->afterCommit();
                }
            }
        });

        return response()->json(['success' => true], 200);
    }
}
