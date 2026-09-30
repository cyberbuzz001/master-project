<?php

namespace App\Models;

use App\Domain\Billing\Money;
use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use LogicException;

#[Fillable(['client_id', 'invoice_date', 'due_date', 'notes', 'place_of_supply', 'is_demo'])]
class Invoice extends Model
{
    use HasDemoFlag;

    public const DRAFT = 'draft';

    public const ISSUED = 'issued';

    public const PARTIALLY_PAID = 'partially_paid';

    public const PAID = 'paid';

    public const OVERDUE = 'overdue';

    public const VOID = 'void';

    protected $attributes = ['status' => self::DRAFT, 'currency' => 'INR'];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'legal_entity_snapshot' => 'array',
            'client_snapshot' => 'array',
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Invoice $invoice): void {
            $invoice->uuid ??= (string) Str::uuid7();
        });

        // Once issued, an invoice is a record: only payment state, void and the PDF fields may move.
        static::updating(function (Invoice $invoice): void {
            if ($invoice->getOriginal('status') === self::DRAFT) {
                return;
            }

            $frozen = ['invoice_number', 'client_id', 'invoice_date', 'currency', 'subtotal_paise',
                'discount_total_paise', 'tax_total_paise', 'grand_total_paise', 'client_snapshot', 'legal_entity_snapshot'];

            if ($invoice->isDirty($frozen)) {
                throw new LogicException('An issued invoice cannot be edited. Void it and raise a new one.');
            }
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function grandTotal(): Money
    {
        return Money::paise((int) $this->grand_total_paise, $this->currency);
    }

    public function amountPaid(): Money
    {
        return Money::paise((int) $this->amount_paid_paise, $this->currency);
    }

    public function balance(): Money
    {
        return Money::paise((int) $this->balance_paise, $this->currency);
    }

    public function isSettled(): bool
    {
        return $this->status === self::PAID;
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [self::ISSUED, self::PARTIALLY_PAID, self::OVERDUE], true);
    }

    /**
     * Clients see their own invoices; staff see what their client scope allows.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('invoices.view')) {
            return $query->whereIn('client_id', Client::query()->visibleTo($user)->select('id'));
        }

        $client = $user->client;

        return $client === null ? $query->whereRaw('1 = 0') : $query->where('client_id', $client->id);
    }
}
