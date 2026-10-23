<?php

namespace App\Domain\Crm;

use App\Models\Lead;
use App\Models\SuppressionRecord;
use Illuminate\Support\Facades\Log;

class LeadScoringEngine
{
    /**
     * Calculate and update score, grade, explanation, and conversion probability for a lead.
     *
     * @param Lead $lead
     * @return array
     */
    public function scoreLead(Lead $lead): array
    {
        // 1. Suppression / Disqualification Gate
        if (
            $lead->communication_state === 'OPTED_OUT' ||
            $lead->communication_state === 'DO_NOT_CONTACT' ||
            $lead->status === 'DND' ||
            $lead->status === 'NOT_INTERESTED' ||
            SuppressionRecord::isSuppressed($lead->mobile)
        ) {
            $result = [
                'score' => 0,
                'grade' => 'DISQUALIFIED',
                'conversion_probability' => 0.0,
                'explanation' => [
                    'Lead is disqualified or suppressed due to explicit opt-out / DND request.',
                ],
            ];

            $lead->update([
                'ai_score' => $result['score'],
                'ai_grade' => $result['grade'],
                'lead_score_explanation' => json_encode($result['explanation']),
                'conversion_probability' => $result['conversion_probability'],
            ]);

            return $result;
        }

        // 2. Paid / Converted Check
        if ($lead->status === 'PAID' || $lead->status === 'CONVERTED' || $lead->ai_conversation_state === 'PAYMENT_VERIFIED') {
            $result = [
                'score' => 100,
                'grade' => 'CONVERTED',
                'conversion_probability' => 1.0,
                'explanation' => [
                    'Lead has completed verified registration and subscription payment.',
                ],
            ];

            $lead->update([
                'ai_score' => $result['score'],
                'ai_grade' => $result['grade'],
                'lead_score_explanation' => json_encode($result['explanation']),
                'conversion_probability' => $result['conversion_probability'],
            ]);

            return $result;
        }

        $points = 0;
        $explanations = [];

        // 3. Contact Data Completeness (Max 25 pts)
        if (!empty($lead->mobile)) {
            $points += 10;
            $explanations[] = '+10 pts: Valid normalized contact mobile number present.';
        }
        if (!empty($lead->full_name) && $lead->full_name !== 'Unnamed Lead') {
            $points += 5;
            $explanations[] = '+5 pts: Verified lead prospect name present.';
        }
        if (!empty($lead->city) || !empty($lead->state)) {
            $points += 5;
            $explanations[] = '+5 pts: Geographic market demographic (city/state) identified.';
        }
        if (!empty($lead->trading_experience) || !empty($lead->demat_status)) {
            $points += 5;
            $explanations[] = '+5 pts: Trading experience and demat profile declared.';
        }

        // 4. Statutory Consent & Permission (Max 15 pts)
        if (in_array($lead->communication_state, ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP'])) {
            $points += 15;
            $explanations[] = '+15 pts: Verified regulatory communication consent recorded.';
        } elseif ($lead->communication_state === 'ELIGIBLE_PHONE') {
            $points += 10;
            $explanations[] = '+10 pts: Phone contact permission confirmed.';
        }

        // 5. Inbound Engagement & Replies (Max 25 pts)
        if ($lead->last_whatsapp_received_at !== null) {
            $points += 15;
            $explanations[] = '+15 pts: Active inbound two-way customer communication on WhatsApp.';
        }

        if (in_array($lead->ai_conversation_state, ['ASKING_QUESTIONS', 'INTERESTED_IN_SERVICE'])) {
            $points += 10;
            $explanations[] = '+10 pts: Customer explicitly asked questions regarding research advisory.';
        }

        // 6. High-Intent Conversion Milestones (Max 35 pts)
        if ($lead->demo_requested_at !== null || in_array($lead->ai_conversation_state, ['DEMO_REQUESTED', 'DEMO_BOOKED'])) {
            $points += 20;
            $explanations[] = '+20 pts: Requested or activated Free Demo evaluation.';
        }

        if ($lead->appointment_requested_at !== null || in_array($lead->ai_conversation_state, ['APPOINTMENT_REQUESTED', 'APPOINTMENT_BOOKED'])) {
            $points += 25;
            $explanations[] = '+25 pts: Direct advisory consultation appointment requested / confirmed.';
        }

        if ($lead->payment_link_generated_at !== null || in_array($lead->ai_conversation_state, ['PAYMENT_INFO_REQUESTED', 'PAYMENT_LINK_SENT', 'PAYMENT_PENDING'])) {
            $points += 30;
            $explanations[] = '+30 pts: Pricing packages reviewed and secure checkout link requested.';
        }

        $finalScore = min(100, max(0, $points));

        // 7. Lead Categorization
        $grade = match (true) {
            $finalScore >= 75 => 'HOT',
            $finalScore >= 50 => 'WARM',
            $finalScore >= 25 => 'ENGAGED',
            default => 'COLD',
        };

        $prob = round($finalScore / 100, 2);

        $lead->update([
            'ai_score' => $finalScore,
            'ai_grade' => $grade,
            'lead_score_explanation' => json_encode($explanations),
            'conversion_probability' => $prob,
        ]);

        return [
            'score' => $finalScore,
            'grade' => $grade,
            'conversion_probability' => $prob,
            'explanation' => $explanations,
        ];
    }
}
