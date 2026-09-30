<?php

namespace App\Domain\Audit;

use App\Domain\Platform\RequestContext;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

final class AuditLogger
{
    /**
     * Attribute names whose values are never written to the audit log.
     */
    private const MASKED = [
        'password', 'remember_token', 'two_factor_secret', 'code_hash', 'value_secret',
        'pan', 'pan_number', 'aadhaar', 'bank_account_number', 'api_key', 'secret', 'token',
    ];

    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public function record(
        string $action,
        ?Model $subject = null,
        ?array $old = null,
        ?array $new = null,
        ?string $reason = null,
        ?User $actor = null,
        string $actorType = 'user',
    ): AuditLog {
        $actor ??= Auth::user();

        return AuditLog::create([
            'request_id' => RequestContext::requestId(),
            'actor_user_id' => $actor?->getKey(),
            'actor_type' => $actor === null && $actorType === 'user' ? 'system' : $actorType,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'old_values' => $old === null ? null : self::mask($old),
            'new_values' => $new === null ? null : self::mask($new),
            'reason' => $reason,
            'ip' => RequestContext::ip(),
            'user_agent' => RequestContext::userAgent(),
            'device_hash' => RequestContext::deviceHash(),
        ]);
    }

    /**
     * Records the dirty attributes of a model that is about to be (or was just) saved.
     *
     * @param  array<string, mixed>  $original
     */
    public function recordChanges(string $action, Model $subject, array $original, ?string $reason = null): AuditLog
    {
        $changed = $subject->getChanges();
        unset($changed['updated_at']);

        $old = array_intersect_key($original, $changed);

        return $this->record($action, $subject, $old, $changed, $reason);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public static function mask(array $values): array
    {
        foreach ($values as $key => $value) {
            if (is_array($value)) {
                $values[$key] = self::mask($value);
            } elseif (is_string($key) && in_array(strtolower($key), self::MASKED, true)) {
                $values[$key] = $value === null ? null : '[REDACTED]';
            }
        }

        return $values;
    }
}
