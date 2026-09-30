<?php

namespace Database\Seeders;

use App\Models\LeadSource;
use Illuminate\Database\Seeder;

class LeadSourceSeeder extends Seeder
{
    public const SOURCES = [
        'website_form' => 'Website form',
        'landing_page' => 'Landing page',
        'risk_assessment' => 'Risk assessment request',
        'google_ads' => 'Google Ads',
        'meta_ads' => 'Meta Ads',
        'organic_search' => 'Organic search',
        'blog' => 'Blog',
        'webinar' => 'Webinar',
        'resource_download' => 'Educational download',
        'referral' => 'Referral link',
        'whatsapp' => 'WhatsApp',
        'api_import' => 'API import',
        'csv_import' => 'CSV import',
        'campaign_form' => 'Campaign form',
        'vendor_feed' => 'Partner / vendor feed',
    ];

    public function run(): void
    {
        foreach (self::SOURCES as $code => $name) {
            LeadSource::query()->updateOrCreate(['code' => $code], ['name' => $name, 'is_active' => true]);
        }
    }
}
