<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'email_attempted', 'outcome', 'ip', 'user_agent', 'device_hash', 'request_id'])]
class LoginHistory extends Model
{
    use AppendOnly;

    public const UPDATED_AT = null;

    public const SUCCESS = 'success';

    public const FAILED = 'failed';

    public const LOCKED = 'locked';

    public const INACTIVE = 'inactive';

    public const TWO_FACTOR_REQUIRED = '2fa_required';

    public const TWO_FACTOR_FAILED = '2fa_failed';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
