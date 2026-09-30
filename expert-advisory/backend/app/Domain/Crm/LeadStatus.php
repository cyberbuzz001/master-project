<?php

namespace App\Domain\Crm;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

enum LeadStatus: string implements HasColor, HasLabel
{
    case New = 'NEW';
    case Npc = 'NPC';
    case CallBack = 'CALL_BACK';
    case FollowUp = 'FOLLOW_UP';
    case FreeTrial = 'FREE_TRIAL';
    case ExpectedPayment = 'EXPECTED_PAYMENT';
    case Paid = 'PAID';
    case NotInterested = 'NOT_INTERESTED';
    case Dnd = 'DND';
    case Invalid = 'INVALID';
    case Converted = 'CONVERTED';
    case Lost = 'LOST';

    /**
     * Statuses a person may set by hand. PAID and CONVERTED are set only by the payment
     * verification workflow (Phase 4) so a lead can never be marked paid without a verified payment.
     */
    private const WORKING = ['NPC', 'CALL_BACK', 'FOLLOW_UP', 'FREE_TRIAL', 'EXPECTED_PAYMENT', 'NOT_INTERESTED', 'DND', 'INVALID', 'LOST'];

    public function getLabel(): string
    {
        return match ($this) {
            self::New => 'New',
            self::Npc => 'NPC (not picking call)',
            self::CallBack => 'Call back',
            self::FollowUp => 'Follow up',
            self::FreeTrial => 'Free trial',
            self::ExpectedPayment => 'Expected payment',
            self::Paid => 'Paid',
            self::NotInterested => 'Not interested',
            self::Dnd => 'Do not disturb',
            self::Invalid => 'Invalid',
            self::Converted => 'Converted',
            self::Lost => 'Lost',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::New => 'info',
            self::Npc, self::CallBack, self::FollowUp => 'warning',
            self::FreeTrial, self::ExpectedPayment => 'primary',
            self::Paid, self::Converted => 'success',
            self::NotInterested, self::Lost, self::Invalid => 'gray',
            self::Dnd => 'danger',
        };
    }

    /**
     * @return list<string> target status values allowed from this status for manual changes
     */
    public function manualTransitions(): array
    {
        $targets = match ($this) {
            self::New, self::Npc, self::CallBack, self::FollowUp => self::WORKING,
            self::FreeTrial => ['EXPECTED_PAYMENT', 'FOLLOW_UP', 'NOT_INTERESTED', 'DND', 'LOST'],
            self::ExpectedPayment => ['FOLLOW_UP', 'CALL_BACK', 'NOT_INTERESTED', 'DND', 'LOST'],
            self::NotInterested, self::Lost => ['FOLLOW_UP', 'CALL_BACK', 'DND', 'INVALID'],
            self::Invalid => ['NEW'],
            self::Dnd => ['NEW'], // lifting DND additionally requires compliance permission and fresh consent
            self::Paid, self::Converted => [],
        };

        return array_values(array_filter($targets, fn (string $t) => $t !== $this->value));
    }

    /**
     * @return list<string>
     */
    public function systemTransitions(): array
    {
        return match ($this) {
            self::ExpectedPayment, self::FreeTrial, self::FollowUp, self::CallBack, self::Npc, self::New => ['PAID'],
            self::Paid => ['CONVERTED'],
            default => [],
        };
    }

    public function isOpen(): bool
    {
        return in_array($this, [self::New, self::Npc, self::CallBack, self::FollowUp, self::FreeTrial, self::ExpectedPayment], true);
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::cases() as $case) {
            $options[$case->value] = $case->getLabel();
        }

        return $options;
    }

    /**
     * @return list<string>
     */
    public static function openValues(): array
    {
        return array_values(array_map(fn (self $s) => $s->value, array_filter(self::cases(), fn (self $s) => $s->isOpen())));
    }
}
