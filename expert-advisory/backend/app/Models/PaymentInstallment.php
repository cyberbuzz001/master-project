<?php

namespace App\Models;

use App\Domain\Billing\Money;
use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentInstallment extends Model
{
    use HasDemoFlag, HasFactory;

    public const PROMISED = 'promised';
    public const DUE = 'due';
    public const RECORDED = 'recorded';
    public const CONFIRMED = 'confirmed';
    public const PARTIALLY_SETTLED = 'partially_settled';
    public const SETTLED = 'settled';
    public const OVERDUE = 'overdue';
    public const FAILED = 'failed';

    protected $fillable = [
        'client_id', 'invoice_id', 'proposal_id', 'installment_number',
        'due_date', 'promised_date', 'amount_paise', 'amount_verified_paise',
        'status', 'reminder_attempts', 'last_reminded_at', 'notes',
        'payment_id', 'is_demo',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'promised_date' => 'date',
            'last_reminded_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(SalesProposal::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function amount(): Money
    {
        return Money::paise($this->amount_paise);
    }

    public function amountVerified(): Money
    {
        return Money::paise($this->amount_verified_paise);
    }

    public function outstandingAmount(): Money
    {
        return Money::paise(max(0, $this->amount_paise - $this->amount_verified_paise));
    }
}
