<?php

namespace App\Models;

use App\Domain\Billing\Money;
use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use LogicException;

#[Fillable(['client_id', 'invoice_id', 'amount_paise', 'method', 'provider', 'provider_reference', 'reference', 'received_at', 'proof_document_id', 'is_demo'])]
class Payment extends Model
{
    use HasDemoFlag;

    public const INITIATED = 'initiated';

    public const PENDING_VERIFICATION = 'pending_verification';

    public const SUCCEEDED = 'succeeded';

    public const FAILED = 'failed';

    public const REFUNDED = 'refunded';

    protected $attributes = ['status' => self::PENDING_VERIFICATION, 'currency' => 'INR'];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'verified_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Payment $payment): void {
            $payment->uuid ??= (string) Str::uuid7();
        });

        // The amount and the payer never change after the fact; corrections are a refund.
        static::updating(function (Payment $payment): void {
            if ($payment->isDirty(['amount_paise', 'currency', 'client_id'])) {
                throw new LogicException('A recorded payment amount is immutable. Record a refund instead.');
            }
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(PaymentEvent::class)->latest('occurred_at')->latest('id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class);
    }

    public function proof(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'proof_document_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function amount(): Money
    {
        return Money::paise((int) $this->amount_paise, $this->currency);
    }

    public function isVerified(): bool
    {
        return $this->status === self::SUCCEEDED;
    }

    public function methodLabel(): string
    {
        return config("billing.payments.labels.{$this->method}", $this->method);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('payments.view')) {
            return $query->whereIn('client_id', Client::query()->visibleTo($user)->select('id'));
        }

        $client = $user->client;

        return $client === null ? $query->whereRaw('1 = 0') : $query->where('client_id', $client->id);
    }
}
