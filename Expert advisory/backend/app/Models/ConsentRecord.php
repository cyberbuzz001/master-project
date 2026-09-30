<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use App\Models\Concerns\HasDemoFlag;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['subject_type', 'subject_id', 'purpose', 'granted', 'channel', 'policy_document_version_id', 'consent_text_hash', 'consent_text', 'ip', 'user_agent', 'request_id', 'is_demo', 'captured_at'])]
class ConsentRecord extends Model
{
    use AppendOnly, HasDemoFlag;

    public $timestamps = false;

    public const PURPOSES = [
        'marketing_email', 'transactional_email', 'whatsapp', 'research_communication', 'educational_content',
        'calls', 'call_recording', 'data_processing', 'terms', 'privacy', 'client_agreement',
    ];

    protected function casts(): array
    {
        return ['granted' => 'boolean', 'is_demo' => 'boolean', 'captured_at' => 'datetime'];
    }
}
