<?php

namespace App\Filament\Resources\Leads\Schemas;

use App\Domain\Crm\PhoneNormalizer;
use App\Models\Campaign;
use App\Models\LeadSource;
use App\Models\Vendor;
use Closure;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class LeadForm
{
    public const SEGMENTS = ['equity' => 'Equity', 'futures' => 'Futures', 'options' => 'Options', 'commodity' => 'Commodities'];

    public const CAPITAL = [
        'under_1l' => 'Under ₹1 lakh', '1l_5l' => '₹1–5 lakh', '5l_25l' => '₹5–25 lakh',
        '25l_1cr' => '₹25 lakh – ₹1 crore', 'over_1cr' => 'Above ₹1 crore', 'prefer_not' => 'Prefers not to say',
    ];

    public const EXPERIENCE = ['none' => 'No experience', 'under_1y' => 'Under 1 year', '1_3y' => '1–3 years', '3_5y' => '3–5 years', 'over_5y' => 'Over 5 years'];

    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Contact')
                ->columns(2)
                ->schema([
                    TextInput::make('full_name')->required()->minLength(2)->maxLength(120),
                    TextInput::make('mobile')
                        ->tel()
                        ->required()
                        ->helperText('10-digit Indian number or international format with +')
                        ->rule(fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                            if (PhoneNormalizer::toE164(is_string($value) ? $value : null) === null) {
                                $fail('Enter a valid mobile number.');
                            }
                        })
                        ->dehydrateStateUsing(fn (?string $state) => PhoneNormalizer::toE164($state) ?? $state),
                    TextInput::make('email')->email()->maxLength(255),
                    TextInput::make('city')->maxLength(80),
                    TextInput::make('state')->maxLength(80),
                    TextInput::make('broker')->maxLength(120)->hiddenOn('create'),
                ]),
            Section::make('Profile')
                ->columns(2)
                ->schema([
                    CheckboxList::make('preferred_segments')->label('Markets followed')->options(self::SEGMENTS)->columns(4)->columnSpanFull(),
                    Select::make('capital_range')->options(self::CAPITAL)->native(false),
                    Select::make('trading_experience')->options(self::EXPERIENCE)->native(false),
                    Textarea::make('message')->label('Notes from the enquiry')->rows(3)->maxLength(2000)->columnSpanFull(),
                ]),
            Section::make('Source')
                ->columns(3)
                ->visibleOn('create')
                ->schema([
                    Select::make('lead_source_id')->label('Source')->options(fn () => LeadSource::query()->where('is_active', true)->orderBy('name')->pluck('name', 'id'))->native(false),
                    Select::make('campaign_id')->label('Campaign')->options(fn () => Campaign::query()->where('status', 'active')->orderByDesc('id')->pluck('name', 'id'))->searchable(),
                    Select::make('vendor_id')->label('Vendor')->options(fn () => Vendor::query()->where('status', 'active')->orderBy('name')->pluck('name', 'id'))->searchable(),
                ]),
            Section::make('Consent')
                ->description('Record only what the person actually agreed to. This is stored with your name and time.')
                ->columns(2)
                ->visibleOn('create')
                ->schema([
                    Radio::make('consent_channel')
                        ->label('How did they agree?')
                        ->options(['call' => 'On an inbound call', 'walk_in' => 'In person', 'referral' => 'Through a referrer who confirmed consent', 'email' => 'In writing / email'])
                        ->required()
                        ->columnSpanFull(),
                    Toggle::make('consent_data_processing')->label('Agreed their details may be stored to respond')->accepted()->required(),
                    Toggle::make('consent_calls')->label('Agreed to phone calls'),
                    Toggle::make('consent_whatsapp')->label('Agreed to WhatsApp messages'),
                    Toggle::make('consent_marketing_email')->label('Agreed to educational emails'),
                ]),
        ]);
    }
}
