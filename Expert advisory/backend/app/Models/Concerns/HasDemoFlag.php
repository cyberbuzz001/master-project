<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * Demo rows are visible only when DEMO_MODE is on. Analytics call withoutDemo() explicitly.
 */
trait HasDemoFlag
{
    public static function bootHasDemoFlag(): void
    {
        static::addGlobalScope('exclude_demo', function (Builder $builder): void {
            if (! config('platform.demo_mode')) {
                $builder->where($builder->getModel()->getTable().'.is_demo', false);
            }
        });
    }

    public function scopeWithoutDemo(Builder $query): Builder
    {
        return $query->withoutGlobalScope('exclude_demo')->where($this->getTable().'.is_demo', false);
    }
}
