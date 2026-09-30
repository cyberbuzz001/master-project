<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['code', 'label', 'owner_employee_id', 'referrer_client_id', 'is_active', 'is_demo'])]
class ReferralCode extends Model
{
    use HasDemoFlag;

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'reward_enabled' => 'boolean', 'is_demo' => 'boolean'];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'owner_employee_id');
    }

    public function referrerClient(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'referrer_client_id');
    }
}
