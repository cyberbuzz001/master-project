<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['lead_id', 'is_first_touch', 'form_key', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'landing_page', 'referrer', 'referral_code', 'vendor_code', 'gclid', 'fbclid', 'ip', 'user_agent', 'captured_at'])]
class LeadAttribution extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['is_first_touch' => 'boolean', 'captured_at' => 'datetime'];
    }
}
