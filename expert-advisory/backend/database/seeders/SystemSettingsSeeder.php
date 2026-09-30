<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

/**
 * Contact details below were published on expertstocks.in as of 2026-09-16 (see docs/CURRENT_SITE_AUDIT.md).
 * They are marked `requires_verification` and stay hidden from the public site until an admin verifies them.
 * Existing values are never overwritten by re-seeding.
 */
class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // key, value, type, public, requires_verification
            ['company.brand_name', 'Expert Stocks Consultancy', 'string', true, false],
            ['company.legal_entity_name', null, 'string', true, true],
            ['company.gstin', null, 'string', false, true],
            ['company.cin', null, 'string', true, true],
            ['contact.email', 'info@expertstocks.in', 'string', true, true],
            ['contact.phone', '+91 73894 87726', 'string', true, true],
            ['contact.whatsapp', '+917389487726', 'string', true, true],
            ['contact.registered_address', 'ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai', 'string', true, true],
            ['contact.branch_address', 'Techno IT Park, Jabalpur, Madhya Pradesh', 'string', true, true],
            ['contact.business_hours', 'Monday to Friday, 9:00 AM – 4:00 PM IST', 'string', true, false],
            ['invoice.number_prefix', 'ESC', 'string', false, false],
            ['comms.whatsapp_enabled', '0', 'bool', false, false],
            ['comms.email_enabled', '0', 'bool', false, false],
            ['crm.auto_assign_enabled', '0', 'bool', false, false],
            ['crm.auto_assign_team_id', null, 'int', false, false],
            ['crm.escalation_new_hours', '2', 'int', false, false],
            ['crm.escalation_idle_hours', '24', 'int', false, false],
            ['documents.auto_purge', '0', 'bool', false, false],
            ['workforce.office_hours_start', '09:00', 'string', false, false],
            ['workforce.office_hours_end', '19:00', 'string', false, false],
            ['workforce.office_days', '[1,2,3,4,5,6]', 'json', false, false],
            ['workforce.enforce_office_hours', '0', 'bool', false, false],
        ];

        foreach ($settings as [$key, $value, $type, $public, $verify]) {
            SystemSetting::query()->firstOrCreate(['key' => $key], [
                'group' => explode('.', $key)[0],
                'value' => $value,
                'type' => $type,
                'is_secret' => false,
                'is_public' => $public,
                'requires_verification' => $verify,
            ]);
        }
    }
}
