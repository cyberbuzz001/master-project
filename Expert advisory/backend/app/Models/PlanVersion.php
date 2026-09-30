<?php

namespace App\Models;

use App\Domain\Billing\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['plan_id', 'version', 'base_price_paise', 'currency', 'tax_code', 'price_includes_tax', 'effective_from', 'inclusions', 'created_by'])]
class PlanVersion extends Model
{
    public const DRAFT = 'draft';

    public const PUBLISHED = 'published';

    public const RETIRED = 'retired';

    protected $attributes = ['status' => self::DRAFT, 'currency' => 'INR'];

    protected function casts(): array
    {
        return [
            'price_includes_tax' => 'boolean',
            'inclusions' => 'array',
            'effective_from' => 'date',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // A price a client was invoiced at can never change; publish a new version instead.
        static::updating(function (PlanVersion $version): void {
            if ($version->getOriginal('status') !== self::DRAFT
                && $version->isDirty(['base_price_paise', 'currency', 'tax_code', 'price_includes_tax', 'version', 'plan_id'])) {
                throw new LogicException('Published prices are immutable. Publish a new plan version instead.');
            }
        });
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function price(): Money
    {
        return Money::paise((int) $this->base_price_paise, $this->currency);
    }

    public function taxRate(): float
    {
        return (float) config("billing.tax_codes.{$this->tax_code}.rate", 0.0);
    }

    public function label(): string
    {
        return $this->plan->name.' — '.$this->price()->format().' / '.$this->plan->cycleLabel();
    }
}
