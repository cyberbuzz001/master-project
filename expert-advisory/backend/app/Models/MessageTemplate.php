<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MessageTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'channel',
        'name',
        'subject',
        'body',
        'variables',
        'status',
        'author_id',
        'approved_by_id',
        'approved_at',
    ];

    protected $casts = [
        'variables' => 'array',
        'approved_at' => 'datetime',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(MessageLog::class, 'template_id');
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }
}
