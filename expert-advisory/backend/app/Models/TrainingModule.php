<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['title', 'summary', 'body_markdown', 'content_url', 'is_mandatory', 'role_names', 'due_within_days'])]
class TrainingModule extends Model
{
    public const DRAFT = 'draft';

    public const PUBLISHED = 'published';

    public const RETIRED = 'retired';

    protected function casts(): array
    {
        return ['is_mandatory' => 'boolean', 'role_names' => 'array', 'published_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        // Changing a published module's content creates a new version everyone must acknowledge again.
        static::updating(function (TrainingModule $module): void {
            if ($module->getOriginal('status') === self::PUBLISHED && $module->isDirty(['title', 'body_markdown', 'content_url'])) {
                $module->version = $module->getOriginal('version') + 1;
            }
        });
    }

    public function acknowledgements(): HasMany
    {
        return $this->hasMany(TrainingAcknowledgement::class);
    }

    public function appliesTo(User $user): bool
    {
        $roles = $this->role_names ?? [];

        return $user->isStaff() && ($roles === [] || $user->hasAnyRole($roles));
    }
}
