<?php

namespace App\Models;

use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'name', 'channel', 'landing_page_url', 'vendor_id', 'budget', 'starts_on', 'ends_on', 'status', 'notes', 'is_demo'])]
class Campaign extends Model
{
    use HasDemoFlag;

    public const CHANNELS = [
        'google_ads' => 'Google Ads', 'meta_ads' => 'Meta Ads', 'organic' => 'Organic / SEO', 'webinar' => 'Webinar',
        'email' => 'Email', 'whatsapp' => 'WhatsApp', 'referral' => 'Referral', 'vendor' => 'Vendor', 'other' => 'Other',
    ];

    protected function casts(): array
    {
        return ['budget' => 'decimal:2', 'starts_on' => 'date', 'ends_on' => 'date', 'is_demo' => 'boolean'];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }
}
