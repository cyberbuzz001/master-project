<?php

namespace App\Models;

use App\Domain\Billing\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'invoice_id', 'plan_version_id', 'description', 'quantity', 'unit_price_paise', 'discount_paise',
    'tax_code', 'tax_rate_percent', 'taxable_paise', 'tax_paise', 'line_total_paise', 'sort_order',
])]
class InvoiceItem extends Model
{
    public $timestamps = false;

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(PlanVersion::class);
    }

    public function lineTotal(): Money
    {
        return Money::paise((int) $this->line_total_paise);
    }
}
