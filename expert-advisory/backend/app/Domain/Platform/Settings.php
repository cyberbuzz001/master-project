<?php

namespace App\Domain\Platform;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class Settings
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function get(string $key, mixed $default = null): mixed
    {
        $setting = SystemSetting::query()->where('key', $key)->first();

        return $setting === null ? $default : self::decode($setting);
    }

    /**
     * Public, non-secret settings grouped for the website. Values requiring verification
     * are only exposed after they have been verified.
     *
     * @return array<string, array<string, mixed>>
     */
    public function publicSettings(): array
    {
        $out = [];

        SystemSetting::query()
            ->where('is_public', true)
            ->where('is_secret', false)
            ->where(fn ($q) => $q->where('requires_verification', false)->orWhereNotNull('verified_at'))
            ->orderBy('key')
            ->get()
            ->each(function (SystemSetting $setting) use (&$out): void {
                $name = substr($setting->key, strlen($setting->group) + 1);
                $out[$setting->group][$name] = self::decode($setting);
            });

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function adminListing(): array
    {
        return SystemSetting::query()->orderBy('key')->get()->map(fn (SystemSetting $s) => [
            'key' => $s->key,
            'group' => $s->group,
            'type' => $s->type,
            'value' => $s->is_secret ? ($s->value === null ? null : '••••••••') : self::decode($s),
            'is_secret' => $s->is_secret,
            'is_public' => $s->is_public,
            'requires_verification' => $s->requires_verification,
            'verified_at' => $s->verified_at?->toIso8601String(),
            'updated_at' => $s->updated_at?->toIso8601String(),
        ])->all();
    }

    /**
     * Updates existing, non-secret settings. Changing a value that requires verification clears its verification.
     *
     * @param  array<string, mixed>  $values
     */
    public function update(User $actor, array $values, ?string $reason): void
    {
        DB::transaction(function () use ($actor, $values, $reason): void {
            foreach ($values as $key => $value) {
                $setting = SystemSetting::query()->where('key', $key)->first();

                if ($setting === null) {
                    throw ApiException::unprocessable('VALIDATION_FAILED', "Unknown setting {$key}.", [$key => ['Unknown setting.']]);
                }

                if ($setting->is_secret) {
                    throw ApiException::forbidden('Secrets are managed through the API credentials module.', 'SECRET_SETTING_FORBIDDEN');
                }

                $old = self::decode($setting);
                $encoded = self::encode($setting->type, $value);

                if ($encoded === $setting->value) {
                    continue;
                }

                $setting->forceFill([
                    'value' => $encoded,
                    'updated_by' => $actor->id,
                    'verified_at' => null,
                    'verified_by' => null,
                ])->save();

                $this->audit->record('settings.updated', $setting, [$key => $old], [$key => $value], $reason);
            }
        });
    }

    public function markVerified(User $actor, string $key): void
    {
        $setting = SystemSetting::query()->where('key', $key)->firstOrFail();

        if ($setting->updated_by === $actor->id) {
            throw ApiException::forbidden('A setting must be verified by someone other than the person who last changed it.', 'SEPARATION_OF_DUTIES');
        }

        $setting->forceFill(['verified_at' => now(), 'verified_by' => $actor->id])->save();
        $this->audit->record('settings.verified', $setting, new: ['key' => $key]);
    }

    private static function decode(SystemSetting $setting): mixed
    {
        $raw = $setting->value;

        if ($raw === null) {
            return null;
        }

        if ($setting->is_secret) {
            $raw = Crypt::decryptString($raw);
        }

        return match ($setting->type) {
            'bool' => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
            'int' => (int) $raw,
            'json' => json_decode($raw, true),
            default => $raw,
        };
    }

    private static function encode(string $type, mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'bool' => $value ? '1' : '0',
            'int' => (string) (int) $value,
            'json' => json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            default => (string) $value,
        };
    }
}
