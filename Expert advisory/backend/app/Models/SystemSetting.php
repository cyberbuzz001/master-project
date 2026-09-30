<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['group', 'key', 'value', 'type', 'is_secret', 'is_public', 'requires_verification', 'updated_by'])]
#[Hidden(['value'])]
class SystemSetting extends Model
{
    protected function casts(): array
    {
        return [
            'is_secret' => 'boolean',
            'is_public' => 'boolean',
            'requires_verification' => 'boolean',
            'verified_at' => 'datetime',
        ];
    }
}
