<?php

namespace App\Domain\Identity;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\TwoFactorRecoveryCode;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

final class TwoFactorService
{
    public function __construct(
        private readonly Google2FA $google2fa,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Starts (or restarts) enrollment. The secret is stored but inactive until confirmed.
     *
     * @return array{secret: string, otpauth_url: string, qr_svg: string}
     */
    public function beginEnrollment(User $user): array
    {
        if ($user->hasTwoFactorEnabled()) {
            throw new ApiException('TWO_FACTOR_ALREADY_ENABLED', 'Two-factor authentication is already enabled.', 409);
        }

        $secret = $this->google2fa->generateSecretKey(32);

        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        $issuer = (string) config('app.name');
        $url = $this->google2fa->getQRCodeUrl($issuer, $user->email, $secret);

        $renderer = new ImageRenderer(new RendererStyle(220, 1), new SvgImageBackEnd);
        $svg = (new Writer($renderer))->writeString($url);

        $this->audit->record('auth.two_factor.enrollment_started', $user);

        return ['secret' => $secret, 'otpauth_url' => $url, 'qr_svg' => $svg];
    }

    /**
     * @return list<string> plain recovery codes, shown once
     */
    public function confirmEnrollment(User $user, string $code): array
    {
        if ($user->two_factor_secret === null || $user->hasTwoFactorEnabled()) {
            throw new ApiException('TWO_FACTOR_NOT_PENDING', 'There is no pending two-factor enrollment.', 409);
        }

        if (! $this->verifyTotp($user, $code)) {
            throw ApiException::unprocessable('TWO_FACTOR_INVALID_CODE', 'The authentication code is invalid.', [
                'code' => ['The authentication code is invalid.'],
            ]);
        }

        return DB::transaction(function () use ($user): array {
            $user->forceFill(['two_factor_confirmed_at' => now()])->save();
            $codes = $this->regenerateRecoveryCodes($user);
            $this->audit->record('auth.two_factor.enabled', $user);

            return $codes;
        });
    }

    public function disable(User $user): void
    {
        if ($user->requiresTwoFactor()) {
            throw ApiException::forbidden('Two-factor authentication is mandatory for your role.', 'TWO_FACTOR_MANDATORY');
        }

        DB::transaction(function () use ($user): void {
            $user->forceFill(['two_factor_secret' => null, 'two_factor_confirmed_at' => null])->save();
            $user->recoveryCodes()->delete();
            $this->audit->record('auth.two_factor.disabled', $user);
        });
    }

    /**
     * Accepts a 6-digit TOTP code or an unused recovery code (consumed on success).
     */
    public function verifyChallenge(User $user, string $code): bool
    {
        $code = trim($code);

        if (preg_match('/^\d{6}$/', $code) === 1) {
            return $this->verifyTotp($user, $code);
        }

        foreach ($user->recoveryCodes()->whereNull('used_at')->get() as $recovery) {
            if (Hash::check(strtoupper($code), $recovery->code_hash)) {
                $recovery->forceFill(['used_at' => now()])->save();
                $this->audit->record('auth.two_factor.recovery_code_used', $user);

                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function regenerateRecoveryCodes(User $user): array
    {
        $user->recoveryCodes()->delete();

        $codes = [];

        for ($i = 0; $i < (int) config('platform.security.recovery_code_count'); $i++) {
            $code = strtoupper(Str::random(5).'-'.Str::random(5));
            $codes[] = $code;
            TwoFactorRecoveryCode::create(['user_id' => $user->id, 'code_hash' => Hash::make($code)]);
        }

        return $codes;
    }

    private function verifyTotp(User $user, string $code): bool
    {
        if ($user->two_factor_secret === null || preg_match('/^\d{6}$/', $code) !== 1) {
            return false;
        }

        return (bool) $this->google2fa->verifyKey($user->two_factor_secret, $code, 1);
    }
}
