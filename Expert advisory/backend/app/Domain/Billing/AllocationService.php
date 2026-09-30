<?php

namespace App\Domain\Billing;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;

/**
 * Credit for a payment. Whoever submits it cannot approve it, credit can never exceed the payment,
 * and only approved credit against a still-verified payment counts towards anything.
 */
final class AllocationService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function approve(User $actor, PaymentAllocation $allocation): PaymentAllocation
    {
        $this->assertApprover($actor, $allocation);

        if ($allocation->status === PaymentAllocation::APPROVED) {
            throw ApiException::unprocessable('ALREADY_APPROVED', 'This credit is already approved.');
        }

        if (! $allocation->payment->isVerified()) {
            throw ApiException::unprocessable('PAYMENT_NOT_VERIFIED', 'Credit can only be approved against a verified payment.');
        }

        $total = PaymentAllocation::query()
            ->where('payment_id', $allocation->payment_id)
            ->where('status', PaymentAllocation::APPROVED)
            ->where('id', '!=', $allocation->id)
            ->sum('amount_paise');

        if (($total + (int) $allocation->amount_paise) > (int) $allocation->payment->amount_paise) {
            throw ApiException::unprocessable('ALLOCATION_TOO_LARGE', 'Approved credit would exceed the payment.');
        }

        $allocation->forceFill([
            'status' => PaymentAllocation::APPROVED,
            'decided_by' => $actor->id,
            'decided_at' => now(),
        ])->save();

        $this->audit->record('allocation.approved', $allocation, new: [
            'employee_id' => $allocation->employee_id, 'amount_paise' => $allocation->amount_paise,
        ], actor: $actor);

        return $allocation;
    }

    public function reject(User $actor, PaymentAllocation $allocation, string $reason): PaymentAllocation
    {
        $this->assertApprover($actor, $allocation);

        if (trim($reason) === '') {
            throw ApiException::unprocessable('REASON_REQUIRED', 'Give a reason for rejecting this credit.');
        }

        $allocation->forceFill([
            'status' => PaymentAllocation::REJECTED,
            'decision_reason' => $reason,
            'decided_by' => $actor->id,
            'decided_at' => now(),
        ])->save();

        $this->audit->record('allocation.rejected', $allocation, new: ['employee_id' => $allocation->employee_id], reason: $reason, actor: $actor);

        return $allocation;
    }

    /**
     * Approved credit for an employee, counting only payments that are still verified — a refunded
     * payment stops counting the moment it is refunded.
     */
    public function approvedTotalFor(int $employeeId, ?string $from = null, ?string $until = null): Money
    {
        $paise = PaymentAllocation::query()
            ->where('employee_id', $employeeId)
            ->where('status', PaymentAllocation::APPROVED)
            ->whereHas('payment', function ($query) use ($from, $until): void {
                $query->where('status', Payment::SUCCEEDED)
                    ->when($from, fn ($q) => $q->whereDate('received_at', '>=', $from))
                    ->when($until, fn ($q) => $q->whereDate('received_at', '<=', $until));
            })
            ->sum('amount_paise');

        return Money::paise((int) $paise);
    }

    private function assertApprover(User $actor, PaymentAllocation $allocation): void
    {
        if (! $actor->can('allocations.approve')) {
            throw ApiException::forbidden('You are not allowed to approve payment credit.');
        }

        if ($allocation->submitted_by !== null && $allocation->submitted_by === $actor->id) {
            throw ApiException::forbidden('Credit must be approved by someone other than the person who submitted it.', 'SEPARATION_OF_DUTIES');
        }
    }
}
