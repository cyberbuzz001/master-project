<?php

namespace App\Models;

use App\Models\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['lead_id', 'from_status', 'to_status', 'changed_by', 'reason'])]
class LeadStatusHistory extends Model
{
    use AppendOnly;

    public const UPDATED_AT = null;
}
