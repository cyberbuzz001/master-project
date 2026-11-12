<?php

namespace App\Domain\Communications;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Throwable;

class TemplateApprovalService
{
    public function saveDraft(User $actor, array $data, ?MessageTemplate $template = null): MessageTemplate
    {
        if (! $actor->can('templates.manage') || ($template && $template->status !== 'draft')) {
            throw ApiException::forbidden();
        }
        $validated = Validator::make($data, [
            'key' => ['required', 'regex:/^[a-z0-9_]+$/', 'max:100', 'unique:message_templates,key'.($template ? ','.$template->id : '')],
            'name' => 'required|string|max:255', 'channel' => 'required|in:email,whatsapp', 'body' => 'required|string|max:4096',
            'subject' => 'nullable|string|max:255', 'variables' => 'nullable|array|max:20',
            'variables.*' => ['string', 'distinct', 'regex:/^[a-zA-Z][a-zA-Z0-9_]*$/'],
            'provider_template_name' => ['nullable', 'regex:/^[a-z0-9_]+$/', 'max:100'],
            'provider_media_id' => 'nullable|string|max:255', 'language_code' => 'required|string|max:16',
            'purpose' => 'nullable|in:whatsapp,research_communication,educational_content,transactional_email,marketing_email',
        ])->validate();

        return DB::transaction(function () use ($actor, $validated, $template): MessageTemplate {
            $template = $template ? MessageTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail() : new MessageTemplate;
            if ($template->exists && $template->status !== 'draft') {
                throw ApiException::forbidden('Approved templates cannot be edited. Create a new version.');
            }
            $template->fill($validated)->forceFill(['author_id' => $actor->id, 'status' => 'draft', 'approved_by_id' => null, 'approved_at' => null, 'provider_status' => null, 'provider_checked_at' => null])->save();
            app(AuditLogger::class)->record('message_template.drafted', $template, new: ['key' => $template->key, 'body_sha256' => hash('sha256', $template->body)], actor: $actor);

            return $template;
        });
    }

    public function approve(User $actor, MessageTemplate $template): void
    {
        DB::transaction(function () use ($actor, $template): void {
            $template = MessageTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();
            if (! $actor->can('templates.approve') || $actor->id === $template->author_id || $template->status !== 'draft') {
                throw ApiException::forbidden('A different authorized reviewer must approve the draft.');
            }
            $template->update(['status' => 'approved', 'approved_by_id' => $actor->id, 'approved_at' => now()]);
            app(AuditLogger::class)->record('message_template.approved', $template, new: ['key' => $template->key, 'body_sha256' => hash('sha256', $template->body)], actor: $actor);
        });
    }

    public function syncMeta(MessageTemplate $template): bool
    {
        $mapping = $this->mappingFingerprint($template);
        $token = config('services.whatsapp.access_token');
        $waba = config('services.whatsapp.business_account_id');
        $version = config('services.whatsapp.graph_version');
        if (! $token || ! ctype_digit((string) $waba) || ! preg_match('/^v[0-9]+\.0$/', (string) $version) || ! $template->provider_template_name) {
            $template->update(['provider_status' => 'NOT_CONFIGURED', 'provider_checked_at' => now()]);

            return false;
        }
        try {
            $response = Http::withToken($token)->connectTimeout(5)->timeout(15)->get("https://graph.facebook.com/{$version}/{$waba}/message_templates", ['name' => $template->provider_template_name, 'limit' => 100]);
            $remote = $response->successful() ? collect($response->json('data', []))->first(fn ($item) => ($item['name'] ?? null) === $template->provider_template_name && ($item['language'] ?? null) === $template->language_code) : null;
            $state = $remote['status'] ?? 'UNVERIFIED';
            $components = collect($remote['components'] ?? []);
            $body = $components->firstWhere('type', 'BODY')['text'] ?? '';
            $expected = $template->body;
            foreach ($template->variables ?? [] as $index => $variable) {
                $expected = str_replace('{{'.$variable.'}}', '{{'.($index + 1).'}}', $expected);
            }
            $header = $components->firstWhere('type', 'HEADER');
            $dynamicUnsupported = $header && ($header['format'] ?? null) === 'TEXT' && str_contains($header['text'] ?? '', '{{');
            foreach ($components->firstWhere('type', 'BUTTONS')['buttons'] ?? [] as $button) {
                if (str_contains($button['url'] ?? '', '{{')) {
                    $dynamicUnsupported = true;
                }
            }
            if ($state === 'APPROVED' && (str_replace("\r\n", "\n", $body) !== str_replace("\r\n", "\n", $expected) || $dynamicUnsupported || ! in_array($header['format'] ?? null, [null, 'TEXT', 'IMAGE', 'DOCUMENT'], true))) {
                $state = 'MAPPING_MISMATCH';
            }

            return DB::transaction(function () use ($template, $mapping, $state, $header): bool {
                $current = MessageTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();
                if (! hash_equals($mapping, $this->mappingFingerprint($current))) {
                    return false;
                }
                $current->update(['provider_status' => $state, 'provider_checked_at' => now(), 'provider_header_format' => $header['format'] ?? null]);

                return $state === 'APPROVED';
            });
        } catch (Throwable) {
            $template->update(['provider_status' => 'UNVERIFIED', 'provider_checked_at' => now()]);

            return false;
        }
    }

    private function mappingFingerprint(MessageTemplate $template): string
    {
        return hash('sha256', json_encode([$template->body, $template->variables, $template->provider_template_name, $template->language_code, $template->provider_media_id], JSON_THROW_ON_ERROR));
    }
}
