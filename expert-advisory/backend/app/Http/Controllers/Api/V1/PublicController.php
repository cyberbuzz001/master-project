<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Billing\DocumentVerifier;
use App\Domain\Compliance\ComplianceGate;
use App\Domain\Crm\LeadIntakeService;
use App\Domain\Crm\PhoneNormalizer;
use App\Domain\Platform\Settings;
use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\PolicyDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PublicController extends Controller
{
    public function __construct(
        private readonly Settings $settings,
        private readonly ComplianceGate $gate,
        private readonly LeadIntakeService $leads,
    ) {}

    public function health(): JsonResponse
    {
        return ApiResponse::success(['status' => 'ok', 'time' => now()->toIso8601String()]);
    }

    public function site(): JsonResponse
    {
        return ApiResponse::success([
            'settings' => $this->settings->publicSettings(),
            'policies' => $this->publishedPolicies(),
            'regulatory_profile_verified' => $this->gate->publicRegulatoryInfo() !== null,
            'consent_text' => LeadIntakeService::CONSENT_TEXT,
        ]);
    }

    public function trustCenter(): JsonResponse
    {
        $info = $this->gate->publicRegulatoryInfo();

        return ApiResponse::success([
            'verified' => $info !== null,
            'regulatory' => $info,
            'policies' => $this->publishedPolicies(),
            'settings' => $this->settings->publicSettings(),
        ]);
    }

    public function policy(string $slug): JsonResponse
    {
        $document = PolicyDocument::query()->where('slug', $slug)->where('is_public', true)->with('publishedVersion')->first();

        if ($document === null) {
            throw new ApiException('NOT_FOUND', 'The requested resource was not found.', 404);
        }

        $version = $document->publishedVersion;

        if ($version === null) {
            throw new ApiException('POLICY_NOT_PUBLISHED', 'This document is being reviewed and has not been published yet.', 404);
        }

        return ApiResponse::success([
            'slug' => $document->slug,
            'title' => $document->title,
            'version' => $version->version,
            'effective_from' => $version->effective_from?->toDateString(),
            'published_at' => $version->published_at?->toIso8601String(),
            'content_hash' => $version->content_hash,
            'body_markdown' => $version->body_markdown,
        ]);
    }

    public function storeLead(Request $request): JsonResponse
    {
        // Honeypot: bots fill hidden fields. Respond identically without storing anything.
        if (filled($request->input('website'))) {
            return self::leadAccepted();
        }

        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:120'],
            'mobile' => ['required', 'string', 'max:20', function (string $attribute, mixed $value, \Closure $fail): void {
                if (PhoneNormalizer::toE164(is_string($value) ? $value : null) === null) {
                    $fail('Enter a valid mobile number.');
                }
            }],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
            'state' => ['nullable', 'string', 'max:80'],
            'message' => ['nullable', 'string', 'max:2000'],
            'form_key' => ['nullable', Rule::in(['contact', 'talk_to_team', 'risk_assessment', 'landing_page', 'resource_download'])],
            'trading_experience' => ['nullable', Rule::in(['none', 'under_1y', '1_3y', '3_5y', 'over_5y'])],
            'capital_range' => ['nullable', Rule::in(['under_1l', '1l_5l', '5l_25l', '25l_1cr', 'over_1cr', 'prefer_not'])],
            'segments' => ['nullable', 'array', 'max:4'],
            'segments.*' => [Rule::in(['equity', 'options', 'futures', 'commodity'])],
            'consents' => ['required', 'array'],
            'consents.data_processing' => ['required', 'accepted'],
            'consents.calls' => ['sometimes', 'boolean'],
            'consents.whatsapp' => ['sometimes', 'boolean'],
            'consents.marketing_email' => ['sometimes', 'boolean'],
            'attribution' => ['nullable', 'array'],
            'attribution.utm_source' => ['nullable', 'string', 'max:255'],
            'attribution.utm_medium' => ['nullable', 'string', 'max:255'],
            'attribution.utm_campaign' => ['nullable', 'string', 'max:255'],
            'attribution.utm_term' => ['nullable', 'string', 'max:255'],
            'attribution.utm_content' => ['nullable', 'string', 'max:255'],
            'attribution.landing_page' => ['nullable', 'string', 'max:2048'],
            'attribution.referrer' => ['nullable', 'string', 'max:2048'],
            'attribution.referral_code' => ['nullable', 'string', 'max:64', 'alpha_dash'],
            'attribution.vendor_code' => ['nullable', 'string', 'max:48', 'alpha_dash'],
            'attribution.gclid' => ['nullable', 'string', 'max:255'],
            'attribution.fbclid' => ['nullable', 'string', 'max:255'],
        ]);

        $this->leads->capture($data);

        return self::leadAccepted();
    }

    /**
     * Identical response for new, duplicate and honeypot submissions — never reveals existing records.
     */
    private static function leadAccepted(): JsonResponse
    {
        return ApiResponse::success([
            'received' => true,
            'message' => 'Thank you. A member of our team will contact you during business hours.',
        ], status: 201);
    }

    /**
     * @return list<array{slug: string, title: string, category: string}>
     */
    private function publishedPolicies(): array
    {
        return PolicyDocument::query()
            ->where('is_public', true)
            ->whereHas('publishedVersion')
            ->orderBy('title')
            ->get(['slug', 'title', 'category'])
            ->map->only(['slug', 'title', 'category'])
            ->values()
            ->all();
    }

    /**
     * Confirms a document we issued — risk report, invoice or receipt. Returns no client details.
     */
    public function verifyDocument(DocumentVerifier $verifier, string $token): JsonResponse
    {
        $result = $verifier->verify($token);

        if ($result === null) {
            return ApiResponse::success(['found' => false]);
        }

        return ApiResponse::success(['found' => true] + $result);
    }
}
