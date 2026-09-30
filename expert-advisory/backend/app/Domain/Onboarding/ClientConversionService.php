<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Crm\LeadStatus;
use App\Domain\Shared\ApiException;
use App\Models\Client;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Turning a lead into a client. Conversion only creates the record and the onboarding checklist —
 * it never implies a payment was received and never activates a service on its own.
 */
final class ClientConversionService
{
    public function __construct(private readonly AuditLogger $audit, private readonly OnboardingService $onboarding) {}

    public function convert(User $actor, Lead $lead, array $attributes = []): Client
    {
        if (! $actor->can('clients.update')) {
            throw ApiException::forbidden('You are not allowed to create client records.');
        }

        if ($lead->status === LeadStatus::Dnd->value) {
            throw ApiException::unprocessable('LEAD_ON_DND', 'This lead is on do-not-disturb and cannot be onboarded.');
        }

        $existing = Client::query()->where('lead_id', $lead->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        return DB::transaction(function () use ($actor, $lead, $attributes): Client {
            $client = Client::create([
                'lead_id' => $lead->id,
                'client_code' => $this->nextCode(),
                'full_name' => $attributes['full_name'] ?? $lead->full_name,
                'email' => $attributes['email'] ?? $lead->email,
                'mobile' => $attributes['mobile'] ?? $lead->mobile,
                'city' => $lead->city,
                'state' => $lead->state,
                'country' => $lead->country ?? 'India',
                'relationship_manager_employee_id' => $attributes['relationship_manager_employee_id'] ?? $lead->assigned_employee_id,
                'is_demo' => (bool) $lead->is_demo,
            ]);

            $client->forceFill(['converted_at' => now()])->save();

            $lead->forceFill(['status' => LeadStatus::Converted->value])->save();

            LeadActivity::create([
                'lead_id' => $lead->id,
                'actor_user_id' => $actor->id,
                'type' => 'status_changed',
                'summary' => 'Converted to client '.$client->client_code,
                'details' => ['client_id' => $client->id],
                'occurred_at' => now(),
            ]);

            $this->audit->record('client.created', $client, new: ['lead_id' => $lead->id, 'client_code' => $client->client_code], actor: $actor);

            $this->onboarding->startChecklist($client);

            return $client->refresh();
        });
    }

    private function nextCode(): string
    {
        $prefix = 'ESC-'.now()->format('Y');
        $last = Client::withTrashed()->where('client_code', 'like', $prefix.'-%')->orderByDesc('id')->value('client_code');
        $serial = $last === null ? 0 : (int) substr($last, strrpos($last, '-') + 1);

        return sprintf('%s-%05d', $prefix, $serial + 1);
    }
}
