<?php

namespace App\Http\Controllers\Api\V1\Client;

use App\Domain\Onboarding\AgreementService;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Onboarding\RiskProfileService;
use App\Domain\Shared\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\KycCheck;
use App\Models\OnboardingStep;
use App\Models\RiskProfile;
use App\Models\RiskQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * What the client can see and do themselves during onboarding. Every route resolves the client from
 * the signed-in user — a client can only ever reach their own record.
 */
final class OnboardingController extends Controller
{
    public function __construct(
        private readonly OnboardingService $onboarding,
        private readonly AgreementService $agreements,
        private readonly RiskProfileService $risk,
        private readonly DocumentVault $vault,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $client = $this->client($request);
        $steps = $this->onboarding->refresh($client);
        $profile = $client->riskProfiles()->with('questionnaireVersion')->first();

        return ApiResponse::success([
            'client' => [
                'client_code' => $client->client_code,
                'full_name' => $client->full_name,
                'onboarding_status' => $client->onboarding_status,
                'kyc_status' => $client->kyc_status,
                'relationship_manager' => $client->relationshipManager?->user?->name,
            ],
            'steps' => $steps->map(fn (OnboardingStep $step) => [
                'key' => $step->key,
                'label' => $step->label,
                'status' => $step->status,
                'is_required' => (bool) $step->is_required,
                'completed_at' => $step->completed_at?->toIso8601String(),
            ])->values(),
            'outstanding_agreements' => collect($this->agreements->outstandingFor($client))->map(fn (AgreementVersion $version) => [
                'id' => $version->id,
                'code' => $version->agreement->code,
                'title' => $version->agreement->title,
                'version' => $version->version,
                'body_markdown' => $version->body_markdown,
                'effective_from' => $version->effective_from?->toDateString(),
            ])->values(),
            'kyc' => $client->kycChecks->map(fn (KycCheck $check) => [
                'type' => $check->type,
                'label' => config("onboarding.kyc.types.{$check->type}.label", $check->type),
                'status' => $check->status,
                'remarks' => $check->status === KycCheck::REJECTED ? $check->remarks : null,
            ])->values(),
            'documents' => $client->documents->map(fn (Document $document) => [
                'uuid' => $document->uuid,
                'title' => $document->title,
                'category' => $document->category,
                'status' => $document->status,
                'rejection_reason' => $document->rejection_reason,
                'uploaded_at' => $document->created_at->toIso8601String(),
            ])->values(),
            'document_categories' => collect(config('onboarding.documents.categories'))
                ->only(['pan', 'aadhaar', 'address_proof', 'bank_proof', 'photo', 'signed_agreement'])
                ->all(),
            'risk_profile' => $profile === null ? null : $this->presentProfile($profile),
        ]);
    }

    public function questionnaire(Request $request): JsonResponse
    {
        $this->client($request);
        $version = $this->risk->publishedQuestionnaire();

        if ($version === null) {
            throw ApiException::unprocessable('NO_QUESTIONNAIRE', 'The questionnaire is not available yet. Your relationship manager will help you complete it.');
        }

        return ApiResponse::success([
            'title' => $version->questionnaire->title,
            'methodology_version' => $version->methodology_version,
            'questions' => $version->questions->map(fn (RiskQuestion $question) => [
                'code' => $question->code,
                'text' => $question->text,
                'help_text' => $question->help_text,
                'type' => $question->type,
                'options' => $question->options->map(fn ($option) => [
                    'value' => $option->value,
                    'label' => $option->label,
                ])->values(),
            ])->values(),
        ]);
    }

    public function submitAssessment(Request $request): JsonResponse
    {
        $client = $this->client($request);
        $version = $this->risk->publishedQuestionnaire();

        if ($version === null) {
            throw ApiException::unprocessable('NO_QUESTIONNAIRE', 'The questionnaire is not available yet.');
        }

        $data = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*' => ['required'],
        ]);

        $profile = $this->risk->submit($client, $version, $data['answers'], $request->user());

        return ApiResponse::success($this->presentProfile($profile), status: 201);
    }

    public function acknowledgeAssessment(Request $request, string $uuid): JsonResponse
    {
        $client = $this->client($request);
        $profile = RiskProfile::query()->where(['uuid' => $uuid, 'client_id' => $client->id])->firstOrFail();

        return ApiResponse::success($this->presentProfile($this->risk->acknowledge($profile, $request->user())));
    }

    public function acceptAgreement(Request $request, AgreementVersion $version): JsonResponse
    {
        $client = $this->client($request);

        $request->validate(['accept' => ['required', 'accepted']]);

        $acceptance = $this->agreements->accept($client, $version, 'portal', acceptedBy: $request->user());

        return ApiResponse::success([
            'uuid' => $acceptance->uuid,
            'accepted_at' => $acceptance->accepted_at->toIso8601String(),
            'agreement' => $version->agreement->title,
            'version' => $version->version,
        ], status: 201);
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        $client = $this->client($request);

        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(config('onboarding.documents.categories')))],
            'file' => ['required', 'file', 'max:'.(int) config('onboarding.documents.max_size_kb')],
        ]);

        $document = $this->vault->store(
            $request->user(),
            'client',
            $client->id,
            $data['category'],
            $request->file('file'),
            ['is_demo' => (bool) $client->is_demo],
        );

        return ApiResponse::success([
            'uuid' => $document->uuid,
            'title' => $document->title,
            'status' => $document->status,
        ], status: 201);
    }

    public function documentLink(Request $request, string $uuid): JsonResponse
    {
        $client = $this->client($request);
        $document = Document::query()->where(['uuid' => $uuid, 'owner_type' => 'client', 'owner_id' => $client->id])->firstOrFail();

        return ApiResponse::success(['url' => $this->vault->temporaryUrl($request->user(), $document)]);
    }

    private function client(Request $request): Client
    {
        $client = $request->user()->client;

        if ($client === null) {
            throw ApiException::unprocessable('NO_CLIENT_RECORD', 'Your client record is still being set up. Your relationship manager will be in touch.');
        }

        return $client->load(['relationshipManager.user:id,name', 'kycChecks', 'documents']);
    }

    private function presentProfile(RiskProfile $profile): array
    {
        $bands = $profile->questionnaireVersion->bandLabels();
        $band = $profile->questionnaireVersion->bandFor($profile->raw_score);

        return [
            'uuid' => $profile->uuid,
            'category' => $profile->risk_category,
            'category_label' => $bands[$profile->risk_category] ?? $profile->risk_category,
            'description' => $band['description'] ?? null,
            'score' => $profile->raw_score,
            'max_score' => $profile->max_score,
            'methodology_version' => $profile->methodology_version,
            'status' => $profile->status,
            'acknowledged_at' => $profile->acknowledged_at?->toIso8601String(),
            'expires_at' => $profile->expires_at?->toIso8601String(),
            'taken_at' => $profile->created_at->toIso8601String(),
        ];
    }
}
