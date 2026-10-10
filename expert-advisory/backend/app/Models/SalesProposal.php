<?php

namespace App\Models;

use App\Domain\Billing\Money;
use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesProposal extends Model
{
    use HasDemoFlag, HasFactory;

    protected $fillable = [
        'proposal_number', 'lead_id', 'client_id', 'employee_id', 'plan_version_id',
        'package_name', 'service_scope', 'duration_days', 'approved_service_fee_paise',
        'registration_amount_paise', 'discount_amount_paise', 'final_agreed_amount_paise',
        'installment_count', 'payment_terms', 'expires_at', 'status',
        'terms_and_disclaimers', 'created_by', 'approved_by', 'accepted_at', 'is_demo',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
            'accepted_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(PlanVersion::class);
    }

    public function installments(): HasMany
    {
        return $this->hasMany(PaymentInstallment::class, 'proposal_id');
    }

    public function finalAmount(): Money
    {
        return Money::paise($this->final_agreed_amount_paise);
    }

    public function serviceFee(): Money
    {
        return Money::paise($this->approved_service_fee_paise);
    }

    public function registrationAmount(): Money
    {
        return Money::paise($this->registration_amount_paise);
    }

    public function discount(): Money
    {
        return Money::paise($this->discount_amount_paise);
    }
}
