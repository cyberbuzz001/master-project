<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'name', 'contact_name', 'contact_email', 'contact_phone', 'cost_per_lead', 'consent_basis', 'status', 'is_demo'])]
class Vendor extends Model
{
    use HasDemoFlag;

    protected function casts(): array
    {
        return ['cost_per_lead' => 'decimal:2', 'is_demo' => 'boolean'];
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class);
    }
}
