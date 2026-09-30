<?php

namespace App\Domain\Workforce;

use App\Domain\Audit\AuditLogger;
use App\Domain\Platform\RequestContext;
use App\Domain\Shared\ApiException;
use App\Models\TrainingAcknowledgement;
use App\Models\TrainingModule;
use App\Models\User;
use Illuminate\Support\Collection;

final class TrainingService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Published mandatory modules (current version) the user has not acknowledged.
     *
     * @return Collection<int, TrainingModule>
     */
    public function pendingMandatoryFor(User $user): Collection
    {
        if (! $user->isStaff()) {
            return collect();
        }

        $acknowledged = TrainingAcknowledgement::query()
            ->where('user_id', $user->id)
            ->get(['training_module_id', 'module_version'])
            ->map(fn (TrainingAcknowledgement $a) => $a->training_module_id.':'.$a->module_version)
            ->flip();

        return TrainingModule::query()
            ->where('status', TrainingModule::PUBLISHED)
            ->where('is_mandatory', true)
            ->get()
            ->filter(fn (TrainingModule $m) => $m->appliesTo($user) && ! $acknowledged->has($m->id.':'.$m->version))
            ->values();
    }

    public function hasAcknowledged(User $user, TrainingModule $module): bool
    {
        return TrainingAcknowledgement::query()
            ->where(['training_module_id' => $module->id, 'module_version' => $module->version, 'user_id' => $user->id])
            ->exists();
    }

    public function acknowledge(User $user, TrainingModule $module): TrainingAcknowledgement
    {
        if ($module->status !== TrainingModule::PUBLISHED || ! $module->appliesTo($user)) {
            throw ApiException::forbidden('This module is not assigned to you.');
        }

        if ($this->hasAcknowledged($user, $module)) {
            throw new ApiException('ALREADY_ACKNOWLEDGED', 'You have already completed this version.', 409);
        }

        $ack = TrainingAcknowledgement::create([
            'training_module_id' => $module->id,
            'module_version' => $module->version,
            'user_id' => $user->id,
            'ip' => RequestContext::ip(),
            'acknowledged_at' => now(),
        ]);

        $this->audit->record('training.acknowledged', $module, new: ['version' => $module->version], actor: $user);

        return $ack;
    }

    public function publish(User $actor, TrainingModule $module): TrainingModule
    {
        if (! $actor->can('training.manage')) {
            throw ApiException::forbidden();
        }

        if ($module->status !== TrainingModule::DRAFT) {
            throw ApiException::invalidTransition($module->status, TrainingModule::PUBLISHED);
        }

        if (blank($module->body_markdown) && blank($module->content_url)) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Add training content or a link before publishing.');
        }

        $module->forceFill(['status' => TrainingModule::PUBLISHED, 'published_by' => $actor->id, 'published_at' => now()])->save();
        $this->audit->record('training.published', $module, new: ['version' => $module->version]);

        return $module;
    }

    public function retire(User $actor, TrainingModule $module): TrainingModule
    {
        if (! $actor->can('training.manage')) {
            throw ApiException::forbidden();
        }

        $module->forceFill(['status' => TrainingModule::RETIRED])->save();
        $this->audit->record('training.retired', $module);

        return $module;
    }
}
