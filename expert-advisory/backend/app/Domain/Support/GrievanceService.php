<?php

namespace App\Domain\Support;

use App\Models\Client;
use App\Models\Grievance;
use App\Models\User;
use Carbon\CarbonImmutable;
use InvalidArgumentException;
use RuntimeException;

class GrievanceService
{
    /**
     * File a new grievance under SEBI Grievance Redressal Mechanism.
     * Sets 21-day statutory SLA countdown automatically.
     *
     * @param array<string, mixed> $data
     * @param ?Client $client
     * @return Grievance
     */
    public function fileGrievance(array $data, ?Client $client = null): Grievance
    {
        $complainantName = trim((string) ($data['complainant_name'] ?? $client?->full_name ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? $client?->email ?? '')));
        $mobile = trim((string) ($data['mobile'] ?? $client?->mobile ?? ''));
        $category = trim((string) ($data['category'] ?? 'other'));
        $subject = trim((string) ($data['subject'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));

        if (empty($complainantName) || empty($email) || empty($subject) || empty($description)) {
            throw new InvalidArgumentException('Complainant name, email, subject, and description are required.');
        }

        if (!array_key_exists($category, Grievance::CATEGORIES)) {
            $category = 'other';
        }

        return Grievance::create([
            'client_id' => $client?->id,
            'complainant_name' => $complainantName,
            'email' => $email,
            'mobile' => $mobile,
            'category' => $category,
            'subject' => $subject,
            'description' => $description,
            'status' => 'new',
            'priority' => $data['priority'] ?? 'medium',
            'sla_due_at' => CarbonImmutable::now()->addDays(21),
        ]);
    }

    /**
     * Assign grievance to a designated Grievance Officer.
     */
    public function assignGrievance(Grievance $grievance, User $officer): Grievance
    {
        $grievance->update([
            'assigned_to_id' => $officer->id,
            'status' => 'assigned',
        ]);

        return $grievance;
    }

    /**
     * Resolve and close a grievance with written resolution findings.
     */
    public function resolveGrievance(Grievance $grievance, string $resolutionNotes, User $resolvedBy): Grievance
    {
        if (empty(trim($resolutionNotes))) {
            throw new InvalidArgumentException('Resolution notes are required to resolve a grievance.');
        }

        $grievance->update([
            'status' => 'resolved',
            'resolution_notes' => trim($resolutionNotes),
            'resolved_at' => CarbonImmutable::now(),
            'resolved_by_id' => $resolvedBy->id,
        ]);

        return $grievance;
    }

    /**
     * Escalate to SEBI SCORES if complainant is unsatisfied or case requires regulator arbitration.
     */
    public function escalateToScores(Grievance $grievance, ?string $scoresRegNo = null): Grievance
    {
        $grievance->update([
            'status' => 'escalated_scores',
            'is_escalated_scores' => true,
            'scores_registration_number' => $scoresRegNo,
        ]);

        return $grievance;
    }
}
