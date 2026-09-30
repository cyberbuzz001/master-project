<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Grievance extends Model
{
    use HasFactory;

    public const CATEGORIES = [
        'advisory' => 'Advisory / Research Advice',
        'research' => 'Research Report Disclosures',
        'billing' => 'Invoicing & Payments',
        'service' => 'Customer Service / Relationship',
        'compliance' => 'Regulatory & Compliance',
        'other' => 'Other',
    ];

    public const STATUSES = [
        'new' => 'New / Unassigned',
        'assigned' => 'Assigned to Grievance Officer',
        'under_review' => 'Under Active Review',
        'resolved' => 'Resolved & Closed',
        'escalated_scores' => 'Escalated to SEBI SCORES',
    ];

    protected $fillable = [
        'tracking_number',
        'client_id',
        'complainant_name',
        'email',
        'mobile',
        'category',
        'subject',
        'description',
        'status',
        'priority',
        'assigned_to_id',
        'sla_due_at',
        'resolution_notes',
        'resolved_at',
        'resolved_by_id',
        'is_escalated_scores',
        'scores_registration_number',
    ];

    protected $casts = [
        'sla_due_at' => 'datetime',
        'resolved_at' => 'datetime',
        'is_escalated_scores' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (Grievance $grievance): void {
            if (empty($grievance->tracking_number)) {
                $count = static::count() + 1;
                $grievance->tracking_number = 'GRV-' . date('Y') . '-' . str_pad((string) $count, 5, '0', STR_PAD_LEFT);
            }
            if (empty($grievance->sla_due_at)) {
                // SEBI mandate: 21 calendar days
                $grievance->sla_due_at = CarbonImmutable::now()->addDays(21);
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

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }

    public function isOverdue(): bool
    {
        return $this->status !== 'resolved' && CarbonImmutable::now()->isAfter($this->sla_due_at);
    }
}
