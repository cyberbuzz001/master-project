<?php

namespace App\Models\Concerns;

use LogicException;

/**
 * Records that must never change after they are written (audit, consent, history).
 */
trait AppendOnly
{
    public static function bootAppendOnly(): void
    {
        static::updating(function (): never {
            throw new LogicException(static::class.' records are append-only and cannot be updated.');
        });

        static::deleting(function (): never {
            throw new LogicException(static::class.' records are append-only and cannot be deleted.');
        });
    }
}
