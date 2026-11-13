<?php

namespace Database\Seeders;

use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the reviewed message catalogue as drafts. Meta approval remains an external step.
 */
class MessageTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::query()->where('user_type', User::TYPE_STAFF)->orderBy('id')->first()
            ?? User::query()->orderBy('id')->first();

        if (! $author) {
            $this->command?->warn('Message templates skipped: no author user exists yet.');

            return;
        }

        foreach ($this->templates() as $template) {
            $record = MessageTemplate::query()->firstOrNew(['key' => $template['key']]);

            if ($record->exists && $record->status !== 'draft') {
                continue;
            }

            $record->fill([...$template, 'author_id' => $author->id, 'status' => 'draft']);
            $record->save();
        }
    }

    /**
     * @return list<array{key: string, name: string, body: string, variables: list<string>, purpose: string, provider_template_name: string, language_code: string, channel: string}>
     */
    private function templates(): array
    {
        return [
            $this->template('free_trial_activation', 'Free trial activation', 'Hello {{name}}, your Expert Stocks research trial is now active until {{expiry}}. You can review eligible research updates here: {{portal_link}}. Research involves risk; no return is guaranteed.', ['name', 'expiry', 'portal_link'], 'research_communication'),
            $this->template('trial_day1_review', 'Trial day-one review', 'Hello {{name}}, your first trial day is complete. Please share your questions or book a review with your relationship manager: {{support_link}}. This message is for service support only.', ['name', 'support_link'], 'whatsapp'),
            $this->template('daily_levels', 'Daily market levels', 'Daily research update for {{name}}: {{instrument}} — support {{support}}, resistance {{resistance}}, invalidation {{invalidation}}. This is research information, not a guaranteed return or personal investment advice.', ['name', 'instrument', 'support', 'resistance', 'invalidation'], 'research_communication'),
            $this->template('research_report_ready', 'Research report ready', 'Hello {{name}}, the research report {{report_title}} is available in your portal: {{portal_link}}. Please review the risk disclosure before acting on any information.', ['name', 'report_title', 'portal_link'], 'research_communication'),
            $this->template('educational_material', 'Educational material', 'Hello {{name}}, the educational material {{material_title}} is ready for you: {{material_link}}. It is provided for learning and does not constitute a recommendation.', ['name', 'material_title', 'material_link'], 'educational_content', 'DOCUMENT'),
            $this->template('payment_received', 'Payment received', 'Hello {{name}}, we received your payment of ₹{{amount}} for {{service}}. Your receipt and subscription details are available here: {{portal_link}}.', ['name', 'amount', 'service', 'portal_link'], 'whatsapp'),
            $this->template('payment_due', 'Payment due reminder', 'Hello {{name}}, your payment of ₹{{amount}} for {{service}} is due on {{due_date}}. Please use the secure client portal: {{portal_link}}. We never request payment to a personal account.', ['name', 'amount', 'service', 'due_date', 'portal_link'], 'whatsapp'),
            $this->template('invoice_ready', 'Invoice ready', 'Hello {{name}}, invoice {{invoice_number}} for ₹{{amount}} is ready in your client portal: {{portal_link}}. Please contact support if any billing detail is incorrect.', ['name', 'invoice_number', 'amount', 'portal_link'], 'whatsapp'),
            $this->template('subscription_expiry', 'Subscription expiry notice', 'Hello {{name}}, your {{service}} subscription expires on {{expiry_date}}. Review renewal options securely in your portal: {{portal_link}}.', ['name', 'service', 'expiry_date', 'portal_link'], 'whatsapp'),
            $this->template('kyc_reminder', 'KYC completion reminder', 'Hello {{name}}, your onboarding is waiting for KYC completion. Please continue securely in your client portal: {{portal_link}}. Our team will never ask for your password or OTP.', ['name', 'portal_link'], 'whatsapp'),
            $this->template('appointment_confirmation', 'Appointment confirmation', 'Hello {{name}}, your {{appointment_type}} appointment is confirmed for {{appointment_time}} with {{advisor_name}}. Need to reschedule? Contact {{support_link}}.', ['name', 'appointment_type', 'appointment_time', 'advisor_name', 'support_link'], 'whatsapp'),
            $this->template('support_ticket_acknowledged', 'Support ticket acknowledgement', 'Hello {{name}}, support ticket {{ticket_number}} has been registered. Our team will respond by {{response_time}}. Track or reply here: {{support_link}}.', ['name', 'ticket_number', 'response_time', 'support_link'], 'whatsapp'),
            $this->template('grievance_acknowledged', 'Grievance acknowledgement', 'Hello {{name}}, your grievance {{grievance_number}} has been registered. The designated team will respond by {{response_time}}. Track status: {{status_link}}.', ['name', 'grievance_number', 'response_time', 'status_link'], 'whatsapp'),
            $this->template('opt_out_confirmation', 'Communication opt-out confirmation', 'Hello {{name}}, your request to stop promotional WhatsApp messages has been recorded. You may still receive essential account, billing, security, and regulatory service notices.', ['name'], 'whatsapp'),
            $this->template('service_incident_update', 'Service incident update', 'Hello {{name}}, we are investigating a service issue affecting {{service}}. The current status is {{status}}. We will provide the next update by {{next_update}}.', ['name', 'service', 'status', 'next_update'], 'whatsapp'),
        ];
    }

    /**
     * @param list<string> $variables
     * @return array{key: string, name: string, body: string, variables: list<string>, purpose: string, provider_template_name: string, language_code: string, channel: string}
     */
    private function template(string $key, string $name, string $body, array $variables, string $purpose, ?string $headerFormat = null): array
    {
        return [
            'key' => $key,
            'name' => $name,
            'channel' => 'whatsapp',
            'body' => $body,
            'variables' => $variables,
            'purpose' => $purpose,
            'provider_template_name' => $key,
            'language_code' => 'en',
            ...($headerFormat ? ['provider_header_format' => $headerFormat] : []),
        ];
    }
}
