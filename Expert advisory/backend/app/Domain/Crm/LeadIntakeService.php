<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Platform\RequestContext;
use App\Domain\Shared\ApiException;
use App\Models\User;
use App\Models\Campaign;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadAttribution;
use App\Models\LeadSource;
use App\Models\LeadStatusHistory;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;

final class LeadIntakeService
{
    /**
     * Consent wording shown next to each checkbox on the public form. Stored verbatim with each consent record.
     */
    public const CONSENT_TEXT = [
        'data_processing' => 'I agree that Expert Stocks Consultancy may store and use the details I have submitted to respond to my enquiry, as described in the Privacy Policy.',
        'calls' => 'I agree to be contacted by phone about my enquiry.',
        'whatsapp' => 'I agree to receive messages about my enquiry on WhatsApp.',
        'marketing_email' => 'I agree to receive educational and service emails. I can unsubscribe at any time.',
    ];

    public function __construct(
        private readonly ConsentRecorder $consents,
        private readonly AuditLogger $audit,
        private readonly LeadAssignmentService $assignments,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public function capture(array $data): Lead
    {
        return DB::transaction(function () use ($data): Lead {
            $mobile = PhoneNormalizer::toE164($data['mobile'] ?? null);
            $email = isset($data['email']) ? mb_strtolower(trim($data['email'])) : null;
            $attribution = $data['attribution'] ?? [];

            $vendor = empty($attribution['vendor_code']) ? null : Vendor::query()->where('code', $attribution['vendor_code'])->first();
            $campaign = empty($attribution['utm_campaign']) ? null : Campaign::query()->where('code', $attribution['utm_campaign'])->first();
            $source = LeadSource::query()->where('code', $this->resolveSourceCode($data['form_key'] ?? null, $attribution, $vendor))->first();
            $segments = array_values(array_intersect($data['segments'] ?? [], ['equity', 'options', 'futures', 'commodity']));

            $lead = Lead::create([
                'full_name' => trim($data['full_name']),
                'mobile' => $mobile,
                'email' => $email,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'country' => $data['country'] ?? 'India',
                'trading_experience' => $data['trading_experience'] ?? null,
                'capital_range' => $data['capital_range'] ?? null,
                'preferred_segments' => $segments,
                'equity_interest' => in_array('equity', $segments, true),
                'options_interest' => in_array('options', $segments, true) || in_array('futures', $segments, true),
                'commodity_interest' => in_array('commodity', $segments, true),
                'lead_source_id' => $source?->id,
                'campaign_id' => $campaign?->id,
                'vendor_id' => $vendor?->id ?? $campaign?->vendor_id,
                'referral_code' => $attribution['referral_code'] ?? null,
                'duplicate_of_lead_id' => $this->findDuplicate($mobile, $email)?->id,
                'message' => $data['message'] ?? null,
            ]);

            LeadAttribution::create([
                'lead_id' => $lead->id,
                'is_first_touch' => true,
                'form_key' => $data['form_key'] ?? null,
                'utm_source' => $attribution['utm_source'] ?? null,
                'utm_medium' => $attribution['utm_medium'] ?? null,
                'utm_campaign' => $attribution['utm_campaign'] ?? null,
                'utm_term' => $attribution['utm_term'] ?? null,
                'utm_content' => $attribution['utm_content'] ?? null,
                'landing_page' => $attribution['landing_page'] ?? null,
                'referrer' => $attribution['referrer'] ?? null,
                'referral_code' => $attribution['referral_code'] ?? null,
                'vendor_code' => $attribution['vendor_code'] ?? null,
                'gclid' => $attribution['gclid'] ?? null,
                'fbclid' => $attribution['fbclid'] ?? null,
                'ip' => RequestContext::ip(),
                'user_agent' => RequestContext::userAgent(),
                'captured_at' => now(),
            ]);

            LeadStatusHistory::create(['lead_id' => $lead->id, 'from_status' => null, 'to_status' => 'NEW', 'reason' => 'Captured from public form']);

            LeadActivity::create([
                'lead_id' => $lead->id,
                'type' => 'captured',
                'summary' => 'Enquiry received via '.($source?->name ?? 'website'),
                'details' => ['form_key' => $data['form_key'] ?? null, 'message' => $data['message'] ?? null],
                'occurred_at' => now(),
            ]);

            $consents = $data['consents'] ?? [];
            foreach (self::CONSENT_TEXT as $purpose => $text) {
                $this->consents->record(
                    'lead',
                    $lead->id,
                    $purpose,
                    (bool) ($consents[$purpose] ?? false),
                    'web_form',
                    $text,
                    $purpose === 'data_processing' ? 'privacy-policy' : null,
                );
            }

            $this->audit->record('lead.captured', $lead, new: [
                'source' => $source?->code,
                'campaign' => $campaign?->code,
                'vendor' => $vendor?->code,
                'duplicate_of_lead_id' => $lead->duplicate_of_lead_id,
            ], actorType: 'system');

            $this->assignments->autoAssign($lead);

            return $lead;
        });
    }

    /**
     * A lead entered by staff (walk-in, inbound call, referral). The creator records how consent was
     * obtained; advisors without wider visibility become the owner so the lead stays in their scope.
     *
     * @param  array<string, mixed>  $data
     */
    public function createByStaff(User $actor, array $data): Lead
    {
        if (! $actor->can('leads.create')) {
            throw ApiException::forbidden();
        }

        $mobile = PhoneNormalizer::toE164($data['mobile'] ?? null)
            ?? throw ApiException::unprocessable('VALIDATION_FAILED', 'Enter a valid mobile number.', ['mobile' => ['Enter a valid mobile number.']]);

        return DB::transaction(function () use ($actor, $data, $mobile): Lead {
            $email = filled($data['email'] ?? null) ? mb_strtolower(trim($data['email'])) : null;
            $segments = array_values(array_intersect($data['preferred_segments'] ?? [], ['equity', 'options', 'futures', 'commodity']));
            $campaign = filled($data['campaign_id'] ?? null) ? Campaign::query()->find($data['campaign_id']) : null;

            $lead = Lead::create([
                'full_name' => trim($data['full_name']),
                'mobile' => $mobile,
                'email' => $email,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'country' => 'India',
                'trading_experience' => $data['trading_experience'] ?? null,
                'capital_range' => $data['capital_range'] ?? null,
                'preferred_segments' => $segments,
                'equity_interest' => in_array('equity', $segments, true),
                'options_interest' => in_array('options', $segments, true) || in_array('futures', $segments, true),
                'commodity_interest' => in_array('commodity', $segments, true),
                'lead_source_id' => $data['lead_source_id'] ?? LeadSource::query()->where('code', 'website_form')->value('id'),
                'campaign_id' => $campaign?->id,
                'vendor_id' => $data['vendor_id'] ?? $campaign?->vendor_id,
                'duplicate_of_lead_id' => $this->findDuplicate($mobile, $email)?->id,
                'message' => $data['message'] ?? null,
            ]);

            LeadAttribution::create([
                'lead_id' => $lead->id,
                'is_first_touch' => true,
                'form_key' => 'staff_entry',
                'utm_campaign' => $campaign?->code,
                'captured_at' => now(),
            ]);

            LeadStatusHistory::create(['lead_id' => $lead->id, 'from_status' => null, 'to_status' => 'NEW', 'changed_by' => $actor->id, 'reason' => 'Entered by staff']);

            LeadActivity::create([
                'lead_id' => $lead->id,
                'type' => 'captured',
                'actor_user_id' => $actor->id,
                'summary' => 'Lead entered by '.$actor->name,
                'details' => ['consent_obtained_via' => $data['consent_channel'] ?? null],
                'occurred_at' => now(),
            ]);

            $channel = (string) ($data['consent_channel'] ?? 'call');
            $how = 'Recorded by '.$actor->name.' ('.$channel.'): ';
            $this->consents->record('lead', $lead->id, 'data_processing', true, 'staff_recorded', $how.'agreed that their details may be stored to respond to the enquiry.', 'privacy-policy');
            $this->consents->record('lead', $lead->id, 'calls', (bool) ($data['consent_calls'] ?? false), 'staff_recorded', $how.'phone call consent.');
            $this->consents->record('lead', $lead->id, 'whatsapp', (bool) ($data['consent_whatsapp'] ?? false), 'staff_recorded', $how.'WhatsApp consent.');
            $this->consents->record('lead', $lead->id, 'marketing_email', (bool) ($data['consent_marketing_email'] ?? false), 'staff_recorded', $how.'educational email consent.');

            $this->audit->record('lead.created_by_staff', $lead, new: ['duplicate_of_lead_id' => $lead->duplicate_of_lead_id]);

            if (! $actor->can('leads.view_all') && $actor->employee !== null) {
                $this->assignments->assignToSelf($actor, $lead);
            } else {
                $this->assignments->autoAssign($lead);
            }

            return $lead;
        });
    }

    private function findDuplicate(?string $mobile, ?string $email): ?Lead
    {
        if ($mobile === null && $email === null) {
            return null;
        }

        return Lead::query()
            ->whereNull('duplicate_of_lead_id')
            ->where('created_at', '>=', now()->subDays((int) config('platform.leads.duplicate_window_days')))
            ->where(function ($query) use ($mobile, $email): void {
                if ($mobile !== null) {
                    $query->orWhere('mobile', $mobile);
                }
                if ($email !== null) {
                    $query->orWhere('email', $email);
                }
            })
            ->orderBy('id')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $attribution
     */
    private function resolveSourceCode(?string $formKey, array $attribution, ?Vendor $vendor): string
    {
        $utmSource = mb_strtolower((string) ($attribution['utm_source'] ?? ''));
        $utmMedium = mb_strtolower((string) ($attribution['utm_medium'] ?? ''));
        $paid = in_array($utmMedium, ['cpc', 'ppc', 'paid', 'paid_social', 'display'], true);

        return match (true) {
            $vendor !== null => 'vendor_feed',
            ! empty($attribution['referral_code']) => 'referral',
            $paid && str_contains($utmSource, 'google') => 'google_ads',
            $paid && (str_contains($utmSource, 'facebook') || str_contains($utmSource, 'instagram') || str_contains($utmSource, 'meta')) => 'meta_ads',
            $utmSource === 'whatsapp' => 'whatsapp',
            $formKey === 'landing_page' => 'landing_page',
            $formKey === 'risk_assessment' => 'risk_assessment',
            $utmMedium === 'organic' || str_contains((string) ($attribution['referrer'] ?? ''), 'google.') => 'organic_search',
            default => 'website_form',
        };
    }
}
