<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeadImportPreviewFactory extends Factory
{
    public function definition(): array
    {
        return ['uploaded_by_id' => User::factory(), 'payload' => ['summary' => [], 'rows' => []], 'source_hash' => hash('sha256', 'fixture'), 'expires_at' => now()->addMinutes(30)];
    }
}
