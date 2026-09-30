<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\RiskAnswer;
use App\Models\RiskOverride;
use App\Models\RiskProfile;
use App\Models\RiskQuestion;
use App\Models\RiskQuestionnaireVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Deterministic risk profiling: the same answers under the same questionnaire version always produce
 * the same score, band and hash. Scores are never estimated and never produced by a model.
 */
final class RiskProfileService
{
    public function __construct(private readonly AuditLogger $audit, private readonly RiskReportGenerator $reports) {}

    /**
     * Score answers without persisting anything (used for previews and tests).
     *
     * @param  array<string, string|list<string>>  $answers  question code => selected value(s)
     * @return array{raw_score: int, max_score: int, band: array, suitability_flags: list<string>, answers_sha256: string, rows: list<array<string, mixed>>}
     */
    public function score(RiskQuestionnaireVersion $version, array $answers): array
    {
        $version->loadMissing('questions.options');
        $rows = [];
        $raw = 0;
        $flags = [];

        foreach ($version->questions as $question) {
            $selected = $answers[$question->code] ?? null;
            $values = array_values(array_filter((array) $selected, fn ($value) => $value !== null && $value !== ''));

            if ($values === []) {
                if ($question->is_required) {
                    throw ApiException::unprocessable('INCOMPLETE_ASSESSMENT', 'Every required question must be answered.', [
                        $question->code => ['This question is required.'],
                    ]);
                }

                continue;
            }

            if ($question->type === RiskQuestion::SINGLE && count($values) > 1) {
                throw ApiException::unprocessable('INVALID_ANSWER', 'Only one option may be selected.', [$question->code => ['Select a single option.']]);
            }

            $options = $question->options->whereIn('value', $values);

            if ($options->count() !== count($values)) {
                throw ApiException::unprocessable('INVALID_ANSWER', 'An answer does not belong to this questionnaire.', [$question->code => ['Unknown option.']]);
            }

            $awarded = (int) $options->sum('score') * $question->weight;
            $raw += $awarded;
            $flags = array_merge($flags, $options->pluck('suitability_flags')->filter()->flatten()->all());

            $rows[] = [
                'risk_question_id' => $question->id,
                'question_code' => $question->code,
                'selected_values' => $values,
                'answer_label' => $options->pluck('label')->join('; '),
                'score_awarded' => $awarded,
            ];
        }

        $max = $version->maxScore();
        $band = $version->bandFor($raw);

        if ($band === null) {
            throw ApiException::unprocessable('NO_MATCHING_BAND', 'The questionnaire has no risk band covering this score. Fix the band configuration.');
        }

        $flags = array_values(array_unique(array_merge($flags, (array) ($band['suitability'] ?? []))));

        return [
            'raw_score' => $raw,
            'max_score' => $max,
            'band' => $band,
            'suitability_flags' => $flags,
            'answers_sha256' => self::hashAnswers($version, $rows),
            'rows' => $rows,
        ];
    }

    /**
     * @param  array<string, string|list<string>>  $answers
     */
    public function submit(Client $client, RiskQuestionnaireVersion $version, array $answers, ?User $actor = null): RiskProfile
    {
        if ($version->status !== RiskQuestionnaireVersion::PUBLISHED) {
            throw ApiException::unprocessable('QUESTIONNAIRE_NOT_PUBLISHED', 'Only a published questionnaire can be used for an assessment.');
        }

        $result = $this->score($version, $answers);
        $validDays = $version->valid_for_days ?? (int) config('onboarding.risk_profile.valid_for_days');

        return DB::transaction(function () use ($client, $version, $result, $actor, $validDays): RiskProfile {
            RiskProfile::query()
                ->where('client_id', $client->id)
                ->whereIn('status', [RiskProfile::SUBMITTED, RiskProfile::FINALIZED])
                ->each(fn (RiskProfile $previous) => $previous->forceFill(['status' => RiskProfile::SUPERSEDED])->save());

            $profile = new RiskProfile;
            $profile->forceFill([
                'client_id' => $client->id,
                'risk_questionnaire_version_id' => $version->id,
                'raw_score' => $result['raw_score'],
                'max_score' => $result['max_score'],
                'methodology_version' => $version->methodology_version,
                'risk_category' => $result['band']['key'],
                'suitability_flags' => $result['suitability_flags'],
                'status' => RiskProfile::SUBMITTED,
                'answers_sha256' => $result['answers_sha256'],
                'submitted_by' => $actor?->id,
                'expires_at' => $validDays > 0 ? now()->addDays($validDays) : null,
                'is_demo' => (bool) $client->is_demo,
            ])->save();

            foreach ($result['rows'] as $row) {
                RiskAnswer::create($row + ['risk_profile_id' => $profile->id]);
            }

            $this->audit->record('risk_profile.submitted', $profile, new: [
                'client_id' => $client->id,
                'risk_category' => $profile->risk_category,
                'raw_score' => $profile->raw_score,
                'methodology_version' => $profile->methodology_version,
            ], actor: $actor);

            return $profile;
        });
    }

    /**
     * Sign-off by a person: the assessment becomes the client's active profile.
     */
    public function finalize(User $actor, RiskProfile $profile): RiskProfile
    {
        if ($profile->status !== RiskProfile::SUBMITTED) {
            throw ApiException::invalidTransition($profile->status, RiskProfile::FINALIZED);
        }

        if (config('onboarding.risk_profile.require_client_acknowledgement') && $profile->acknowledged_at === null) {
            throw ApiException::unprocessable('NOT_ACKNOWLEDGED', 'The client must acknowledge the outcome before it is signed off.');
        }

        $profile->forceFill(['status' => RiskProfile::FINALIZED, 'finalized_by' => $actor->id, 'finalized_at' => now()])->save();
        $profile->client->forceFill(['risk_profile_id' => $profile->id])->save();

        $this->audit->record('risk_profile.finalized', $profile, new: ['risk_category' => $profile->risk_category], actor: $actor);

        // Sign-off issues the report the client can keep and verify.
        $this->reports->generate($profile, $actor);

        return $profile;
    }

    public function acknowledge(RiskProfile $profile, ?User $actor = null): RiskProfile
    {
        if ($profile->acknowledged_at === null) {
            $profile->forceFill(['acknowledged_at' => now()])->save();
            $this->audit->record('risk_profile.acknowledged', $profile, actor: $actor);
        }

        return $profile;
    }

    /**
     * A human may move the category, but only with a written reason, and the computed score stays on record.
     */
    public function override(User $actor, RiskProfile $profile, string $toCategory, string $reason): RiskOverride
    {
        if (! $actor->can('risk_profile.override')) {
            throw ApiException::forbidden('You are not allowed to override a risk category.');
        }

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'A reason is required for an override.');
        }

        $labels = $profile->questionnaireVersion->bandLabels();

        if (! array_key_exists($toCategory, $labels)) {
            throw ApiException::unprocessable('UNKNOWN_CATEGORY', 'That category does not exist in this questionnaire version.');
        }

        if ($toCategory === $profile->risk_category) {
            throw ApiException::unprocessable('NO_CHANGE', 'The profile already has that category.');
        }

        return DB::transaction(function () use ($actor, $profile, $toCategory, $reason): RiskOverride {
            $from = $profile->risk_category;

            $override = RiskOverride::create([
                'risk_profile_id' => $profile->id,
                'from_category' => $from,
                'to_category' => $toCategory,
                'reason' => $reason,
                'created_by' => $actor->id,
            ]);

            $profile->forceFill(['risk_category' => $toCategory])->save();

            $this->audit->record('risk_profile.overridden', $profile, old: ['risk_category' => $from], new: ['risk_category' => $toCategory], reason: $reason, actor: $actor);

            return $override;
        });
    }

    /**
     * The questionnaire assessments are taken under: the published suitability one, or any other
     * published questionnaire if the code has been changed.
     */
    public function publishedQuestionnaire(): ?RiskQuestionnaireVersion
    {
        $published = fn () => RiskQuestionnaireVersion::query()
            ->where('status', RiskQuestionnaireVersion::PUBLISHED)
            ->whereHas('questionnaire', fn ($query) => $query->where('is_active', true))
            ->with('questions.options');

        return $published()->whereHas('questionnaire', fn ($query) => $query->where('code', 'suitability'))->latest('version')->first()
            ?? $published()->latest('version')->first();
    }

    public function activeFor(Client $client): ?RiskProfile
    {
        return RiskProfile::query()
            ->where('client_id', $client->id)
            ->where('status', RiskProfile::FINALIZED)
            ->latest('id')
            ->first();
    }

    /**
     * Stable across machines and runs: questionnaire identity plus the answers in question order.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private static function hashAnswers(RiskQuestionnaireVersion $version, array $rows): string
    {
        $payload = [
            'questionnaire' => $version->risk_questionnaire_id,
            'version' => $version->version,
            'methodology' => $version->methodology_version,
            'answers' => array_map(fn (array $row) => [$row['question_code'], $row['selected_values'], $row['score_awarded']], $rows),
        ];

        return hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
    }
}
