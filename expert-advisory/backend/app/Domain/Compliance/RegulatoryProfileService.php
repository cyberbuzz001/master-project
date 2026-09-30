<?php

namespace App\Domain\Compliance;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\RegulatoryProfileVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class RegulatoryProfileService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function active(): ?RegulatoryProfileVersion
    {
        return RegulatoryProfileVersion::query()
            ->where('status', RegulatoryProfileVersion::VERIFIED)
            ->orderByDesc('version')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createDraft(User $actor, array $attributes): RegulatoryProfileVersion
    {
        return DB::transaction(function () use ($actor, $attributes): RegulatoryProfileVersion {
            $version = new RegulatoryProfileVersion($attributes);
            $version->forceFill([
                'version' => (int) RegulatoryProfileVersion::query()->lockForUpdate()->max('version') + 1,
                'status' => RegulatoryProfileVersion::DRAFT,
                'created_by' => $actor->id,
            ])->save();

            $this->audit->record('regulatory_profile.draft_created', $version, new: $version->only(array_keys($attributes)));

            return $version;
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateDraft(User $actor, RegulatoryProfileVersion $version, array $attributes): RegulatoryProfileVersion
    {
        if ($version->status !== RegulatoryProfileVersion::DRAFT) {
            throw ApiException::invalidTransition($version->status, 'edit');
        }

        $original = $version->getOriginal();
        $version->fill($attributes)->save();
        $this->audit->recordChanges('regulatory_profile.draft_updated', $version, $original);

        return $version;
    }

    public function submit(User $actor, RegulatoryProfileVersion $version): RegulatoryProfileVersion
    {
        if ($version->status !== RegulatoryProfileVersion::DRAFT) {
            throw ApiException::invalidTransition($version->status, RegulatoryProfileVersion::PENDING);
        }

        $problems = RegulatoryProfileRules::completenessProblems($version);

        if ($problems !== []) {
            throw ApiException::unprocessable('REGULATORY_PROFILE_INCOMPLETE', 'The regulatory profile is incomplete.', $problems);
        }

        $version->forceFill([
            'status' => RegulatoryProfileVersion::PENDING,
            'submitted_by' => $actor->id,
            'submitted_at' => now(),
        ])->save();

        $this->audit->record('regulatory_profile.submitted', $version, ['status' => RegulatoryProfileVersion::DRAFT], ['status' => RegulatoryProfileVersion::PENDING]);

        return $version;
    }

    public function verify(User $actor, RegulatoryProfileVersion $version, string $evidence): RegulatoryProfileVersion
    {
        if ($version->status !== RegulatoryProfileVersion::PENDING) {
            throw ApiException::invalidTransition($version->status, RegulatoryProfileVersion::VERIFIED);
        }

        if (in_array($actor->id, [$version->created_by, $version->submitted_by], true)) {
            throw ApiException::forbidden('A regulatory profile must be verified by a different person than its author or submitter.', 'SEPARATION_OF_DUTIES');
        }

        return DB::transaction(function () use ($actor, $version, $evidence): RegulatoryProfileVersion {
            $previous = $this->active();

            if ($previous !== null) {
                $previous->forceFill(['status' => RegulatoryProfileVersion::SUPERSEDED, 'superseded_at' => now()])->save();
                $this->audit->record('regulatory_profile.superseded', $previous, ['status' => RegulatoryProfileVersion::VERIFIED], ['status' => RegulatoryProfileVersion::SUPERSEDED]);
            }

            $version->forceFill([
                'status' => RegulatoryProfileVersion::VERIFIED,
                'verified_by' => $actor->id,
                'verified_at' => now(),
                'verification_evidence' => $evidence,
            ])->save();

            $this->audit->record('regulatory_profile.verified', $version, ['status' => RegulatoryProfileVersion::PENDING], ['status' => RegulatoryProfileVersion::VERIFIED], $evidence);

            return $version;
        });
    }

    public function reject(User $actor, RegulatoryProfileVersion $version, string $reason): RegulatoryProfileVersion
    {
        if ($version->status !== RegulatoryProfileVersion::PENDING) {
            throw ApiException::invalidTransition($version->status, RegulatoryProfileVersion::REJECTED);
        }

        $version->forceFill(['status' => RegulatoryProfileVersion::REJECTED, 'rejection_reason' => $reason])->save();
        $this->audit->record('regulatory_profile.rejected', $version, ['status' => RegulatoryProfileVersion::PENDING], ['status' => RegulatoryProfileVersion::REJECTED], $reason);

        return $version;
    }
}
