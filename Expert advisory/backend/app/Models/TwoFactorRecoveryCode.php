<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'code_hash', 'used_at'])]
#[Hidden(['code_hash'])]
class TwoFactorRecoveryCode extends Model
{
    protected function casts(): array
    {
        return ['used_at' => 'datetime'];
    }
}
