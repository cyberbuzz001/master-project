<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasFactory;

    public const CATEGORIES = [
        'billing' => 'Billing & Invoices',
        'kyc' => 'KYC & Verification',
        'onboarding' => 'Risk Profile & Onboarding',
        'technical' => 'Portal Access & Technical',
        'general' => 'General Inquiry',
    ];

    public const STATUSES = [
        'open' => 'Open',
        'in_progress' => 'In Progress',
        'waiting_on_client' => 'Waiting on Client',
        'closed' => 'Closed',
    ];

    protected $fillable = [
        'ticket_number',
        'client_id',
        'subject',
        'category',
        'priority',
        'status',
        'assigned_to_id',
        'last_reply_at',
        'closed_at',
    ];

    protected $casts = [
        'last_reply_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (SupportTicket $ticket): void {
            if (empty($ticket->ticket_number)) {
                $count = static::count() + 1;
                $ticket->ticket_number = 'TKT-' . date('Y') . '-' . str_pad((string) $count, 5, '0', STR_PAD_LEFT);
            }
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->orderBy('created_at');
    }
}
