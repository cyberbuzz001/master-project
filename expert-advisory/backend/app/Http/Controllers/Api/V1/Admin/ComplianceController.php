<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Compliance\ComplianceGate;
use App\Domain\Compliance\PolicyDocumentService;
use App\Domain\Compliance\RegulatoryProfileService;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use App\Models\RegulatoryProfileVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ComplianceController extends Controller
{
    public function __construct(
        private readonly RegulatoryProfileService $profiles,
        private readonly PolicyDocumentService $policies,
        private readonly ComplianceGate $gate,
    ) {}

    // ---- Regulatory profile ----------------------------------------------------------

    public function profileIndex(): JsonResponse
    {
        $versions = RegulatoryProfileVersion::query()
            ->with(['creator:id,name', 'verifier:id,name'])
            ->orderByDesc('version')
            ->get()
            ->map(fn (RegulatoryProfileVersion $v) => self::presentProfile($v));

        return ApiResponse::success([
            'entity_types' => RegulatoryProfileVersion::ENTITY_TYPES,
            'active_version' => $this->profiles->active()?->version,
            'versions' => $versions,
        ]);
    }

    public function profileStore(Request $request): JsonResponse
    {
        $version = $this->profiles->createDraft($request->user(), $this->validateProfile($request, true));

        return ApiResponse::success(self::presentProfile($version->fresh()), status: 201);
    }

    public function profileUpdate(Request $request, RegulatoryProfileVersion $version): JsonResponse
    {
        $version = $this->profiles->updateDraft($request->user(), $version, $this->validateProfile($request, false));

        return ApiResponse::success(self::presentProfile($version->fresh()));
    }

    public function profileSubmit(Request $request, RegulatoryProfileVersion $version): JsonResponse
    {
        return ApiResponse::success(self::presentProfile($this->profiles->submit($request->user(), $version)));
    }

    public function profileVerify(Request $request, RegulatoryProfileVersion $version): JsonResponse
    {
        $data = $request->validate(['verification_evidence' => ['required', 'string', 'min:10', 'max:1000']]);

        return ApiResponse::success(self::presentProfile($this->profiles->verify($request->user(), $version, $data['verification_evidence'])));
    }

    public function profileReject(Request $request, RegulatoryProfileVersion $version): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        return ApiResponse::success(self::presentProfile($this->profiles->reject($request->user(), $version, $data['reason'])));
    }

    public function readiness(Request $request): JsonResponse
    {
        $category = $request->validate([
            'category' => ['nullable', Rule::in([ComplianceGate::CATEGORY_RECOMMENDATION, ComplianceGate::CATEGORY_RESEARCH_REPORT, ComplianceGate::CATEGORY_EDUCATIONAL])],
        ])['category'] ?? ComplianceGate::CATEGORY_RESEARCH_REPORT;

        $checks = $this->gate->readiness($category);

        return ApiResponse::success([
            'category' => $category,
            'ready' => collect($checks)->every(fn ($c) => $c['passed']),
            'checks' => $checks,
        ]);
    }

    // ---- Policy documents ------------------------------------------------------------

    public function policyIndex(): JsonResponse
    {
        $documents = PolicyDocument::query()->with('versions')->orderBy('title')->get()->map(fn (PolicyDocument $doc) => [
            'slug' => $doc->slug,
            'title' => $doc->title,
            'category' => $doc->category,
            'is_public' => $doc->is_public,
            'published_version' => $doc->versions->firstWhere('status', PolicyDocumentVersion::PUBLISHED)?->version,
            'versions' => $doc->versions->map(fn (PolicyDocumentVersion $v) => self::presentPolicyVersion($v, false))->values(),
        ]);

        return ApiResponse::success($documents);
    }

    public function policyVersionShow(PolicyDocumentVersion $version): JsonResponse
    {
        return ApiResponse::success(self::presentPolicyVersion($version->load('document'), true));
    }

    public function policyStore(Request $request, PolicyDocument $document): JsonResponse
    {
        $data = $request->validate([
            'body_markdown' => ['required', 'string', 'min:20', 'max:200000'],
            'change_summary' => ['nullable', 'string', 'max:1000'],
            'effective_from' => ['nullable', 'date'],
            'review_due_at' => ['nullable', 'date', 'after:today'],
            'source_url' => ['nullable', 'url', 'max:2048'],
        ]);

        $version = $this->policies->createDraft($request->user(), $document, $data);

        return ApiResponse::success(self::presentPolicyVersion($version->fresh(), true), status: 201);
    }

    public function policyApprove(Request $request, PolicyDocumentVersion $version): JsonResponse
    {
        return ApiResponse::success(self::presentPolicyVersion($this->policies->approve($request->user(), $version), false));
    }

    public function policyPublish(Request $request, PolicyDocumentVersion $version): JsonResponse
    {
        return ApiResponse::success(self::presentPolicyVersion($this->policies->publish($request->user(), $version), false));
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProfile(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'entity_type' => [$required, Rule::in(array_keys(RegulatoryProfileVersion::ENTITY_TYPES))],
            'legal_entity_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'brand_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'research_status' => ['sometimes', 'nullable', 'string', 'max:255'],
            'registration_number' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Z0-9\/\-]+$/'],
            'registration_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'registration_valid_until' => ['sometimes', 'nullable', 'date'],
            'ra_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ra_contact_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'ra_contact_phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'principal_officer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'compliance_officer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'grievance_officer_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'grievance_officer_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'grievance_officer_phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'raasb_details' => ['sometimes', 'nullable', 'array'],
            'partner_ra' => ['sometimes', 'nullable', 'array'],
            'partner_ra.name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'partner_ra.registration_number' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Z0-9\/\-]+$/'],
            'partner_ra.agreement_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'authorized_persons' => ['sometimes', 'nullable', 'array'],
            'applicable_disclosures' => ['sometimes', 'nullable', 'array'],
            'advertising_rules' => ['sometimes', 'nullable', 'array'],
            'research_approval_required' => ['sometimes', 'boolean'],
            'personalized_advice_allowed' => ['sometimes', 'boolean'],
            'performance_claim_policy' => ['sometimes', Rule::in(['none', 'ledger_only'])],
            'whatsapp_policy' => ['sometimes', 'nullable', 'array'],
            'email_policy' => ['sometimes', 'nullable', 'array'],
            'public_statement' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'review_due_at' => ['sometimes', 'nullable', 'date', 'after:today'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function presentProfile(RegulatoryProfileVersion $v): array
    {
        return array_merge($v->only([
            'id', 'version', 'status', 'entity_type', 'legal_entity_name', 'brand_name', 'research_status',
            'registration_number', 'ra_name', 'ra_contact_email', 'ra_contact_phone', 'principal_officer',
            'compliance_officer', 'grievance_officer_name', 'grievance_officer_email', 'grievance_officer_phone',
            'raasb_details', 'partner_ra', 'authorized_persons', 'applicable_disclosures', 'advertising_rules',
            'research_approval_required', 'personalized_advice_allowed', 'performance_claim_policy',
            'whatsapp_policy', 'email_policy', 'public_statement', 'verification_evidence', 'rejection_reason',
        ]), [
            'registration_date' => $v->registration_date?->toDateString(),
            'registration_valid_until' => $v->registration_valid_until?->toDateString(),
            'review_due_at' => $v->review_due_at?->toDateString(),
            'created_by' => $v->creator?->name,
            'verified_by' => $v->verifier?->name,
            'submitted_at' => $v->submitted_at?->toIso8601String(),
            'verified_at' => $v->verified_at?->toIso8601String(),
            'created_at' => $v->created_at?->toIso8601String(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function presentPolicyVersion(PolicyDocumentVersion $v, bool $withBody): array
    {
        $payload = [
            'id' => $v->id,
            'version' => $v->version,
            'status' => $v->status,
            'content_hash' => $v->content_hash,
            'change_summary' => $v->change_summary,
            'effective_from' => $v->effective_from?->toDateString(),
            'review_due_at' => $v->review_due_at?->toDateString(),
            'source_url' => $v->source_url,
            'created_by' => $v->created_by,
            'approved_by' => $v->approved_by,
            'approved_at' => $v->approved_at?->toIso8601String(),
            'published_at' => $v->published_at?->toIso8601String(),
            'created_at' => $v->created_at?->toIso8601String(),
        ];

        if ($withBody) {
            $payload['document'] = $v->document?->only(['slug', 'title']);
            $payload['body_markdown'] = $v->body_markdown;
        }

        return $payload;
    }
}
