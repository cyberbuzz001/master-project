<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['code', 'name', 'is_active'])]
class LeadSource extends Model
{
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
