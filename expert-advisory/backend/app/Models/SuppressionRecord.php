<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SuppressionRecord extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'suppressed_at' => 'datetime',
        ];
    }

    public function actorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    /**
     * Check if a phone or email is currently suppressed from communication.
     */
    public static function isSuppressed(?string $phone, ?string $email = null, string $channel = 'all'): bool
    {
        if (empty($phone) && empty($email)) {
            return false;
        }

        return static::query()
            ->where(function ($q) use ($phone, $email) {
                if ($phone) {
                    $q->where('phone_e164', $phone);
                }
                if ($email) {
                    $q->orWhere('email', mb_strtolower(trim($email)));
                }
            })
            ->where(function ($q) use ($channel) {
                $q->where('channel', 'all')
                  ->orWhere('channel', $channel);
            })
            ->exists();
    }
}
