<?php

namespace App\Models;

use App\Domain\Billing\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['payment_id', 'employee_id', 'amount_paise', 'note', 'submitted_by'])]
class PaymentAllocation extends Model
{
    public const SUBMITTED = 'submitted';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    protected $attributes = ['status' => self::SUBMITTED];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function amount(): Money
    {
        return Money::paise((int) $this->amount_paise);
    }
}
