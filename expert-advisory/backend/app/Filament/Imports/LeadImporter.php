<?php

namespace App\Filament\Imports;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Crm\LeadAssignmentService;
use App\Domain\Crm\PhoneNormalizer;
use App\Models\Campaign;
use App\Models\Employee;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadAttribution;
use App\Models\LeadSource;
use App\Models\LeadStatusHistory;
use App\Models\User;
use App\Models\Vendor;
use Filament\Actions\Imports\Exceptions\RowImportFailedException;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Filament\Forms\Components\Checkbox;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Illuminate\Support\Number;

class LeadImporter extends Importer
{
    protected static ?string $model = Lead::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('full_name')
                ->label('Full name')
                ->requiredMapping()
                ->guess(['name', 'customer name', 'client name'])
                ->rules(['required', 'string', 'min:2', 'max:120'])
                ->example('Ravi Kumar'),
            ImportColumn::make('mobile')
                ->requiredMapping()
                ->guess(['phone', 'mobile number', 'contact', 'phone number'])
                ->castStateUsing(fn (?string $state): ?string => PhoneNormalizer::toE164($state) ?? $state)
                ->rules(['required', 'regex:/^\+\d{8,15}$/'])
                ->sensitive()
                ->example('9876543210'),
            ImportColumn::make('email')
                ->rules(['nullable', 'email', 'max:255'])
                ->castStateUsing(fn (?string $state): ?string => $state === null ? null : mb_strtolower(trim($state)))
                ->sensitive()
                ->example('ravi@example.com'),
            ImportColumn::make('city')->rules(['nullable', 'string', 'max:80'])->example('Pune'),
            ImportColumn::make('state')->rules(['nullable', 'string', 'max:80'])->example('Maharashtra'),
            ImportColumn::make('preferred_segments')
                ->label('Segments')
                ->multiple(',')
                ->castStateUsing(fn (array $state): array => array_values(array_intersect(array_map(fn ($s) => mb_strtolower(trim((string) $s)), $state), ['equity', 'options', 'futures', 'commodity'])))
                ->helperText('Comma-separated: equity, options, futures, commodity')
                ->example('equity,options'),
            ImportColumn::make('capital_range')
                ->rules(['nullable', 'in:under_1l,1l_5l,5l_25l,25l_1cr,over_1cr,prefer_not'])
                ->example('1l_5l'),
            ImportColumn::make('trading_experience')
                ->rules(['nullable', 'in:none,under_1y,1_3y,3_5y,over_5y'])
                ->example('1_3y'),
            ImportColumn::make('message')
                ->label('Notes')
                ->rules(['nullable', 'string', 'max:2000']),
        ];
    }

    public static function getOptionsFormComponents(): array
    {
        return [
            Select::make('vendor_id')
                ->label('Vendor / partner')
                ->options(fn () => Vendor::query()->where('status', 'active')->orderBy('name')->pluck('name', 'id'))
                ->searchable()
                ->helperText('Leave empty for your own lists. Vendor leads require a recorded consent basis on the vendor.'),
            Select::make('campaign_id')
                ->label('Campaign')
                ->options(fn () => Campaign::query()->orderByDesc('id')->pluck('name', 'id'))
                ->searchable(),
            Textarea::make('consent_basis')
                ->label('How did these people consent to be contacted?')
                ->required()
                ->minLength(15)
                ->maxLength(1000)
                ->helperText('Recorded with every lead in this file, e.g. “Webinar registration form on 12 Sep 2026 with call consent checkbox”.'),
            Checkbox::make('consent_calls')->label('They agreed to phone calls'),
            Checkbox::make('consent_whatsapp')->label('They agreed to WhatsApp messages'),
            Checkbox::make('confirm')
                ->label('I confirm this list was lawfully obtained with the consent described above')
                ->accepted(),
            Select::make('assign_to_employee_id')
                ->label('Assign all to')
                ->options(fn () => app(LeadAssignmentService::class)->assignableEmployees(auth()->user())->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                ->searchable()
                ->visible(fn () => auth()->user()?->can('leads.assign'))
                ->helperText('Leave empty to use automatic assignment rules.'),
        ];
    }

    public function resolveRecord(): Lead
    {
        $vendorId = $this->options['vendor_id'] ?? null;

        if ($vendorId !== null && blank(Vendor::query()->whereKey($vendorId)->value('consent_basis'))) {
            throw new RowImportFailedException('The selected vendor has no recorded consent basis. Update the vendor before importing its leads.');
        }

        return new Lead;
    }

    protected function beforeSave(): void
    {
        /** @var Lead $lead */
        $lead = $this->record;
        $vendorId = $this->options['vendor_id'] ?? null;
        $campaignId = $this->options['campaign_id'] ?? null;
        $segments = $lead->preferred_segments ?? [];

        $lead->forceFill([
            'status' => 'NEW',
            'import_id' => $this->import->getKey(),
            'vendor_id' => $vendorId ?? Campaign::query()->whereKey($campaignId)->value('vendor_id'),
            'campaign_id' => $campaignId,
            'lead_source_id' => LeadSource::query()->where('code', $vendorId ? 'vendor_feed' : 'csv_import')->value('id'),
            'country' => 'India',
            'equity_interest' => in_array('equity', $segments, true),
            'options_interest' => in_array('options', $segments, true) || in_array('futures', $segments, true),
            'commodity_interest' => in_array('commodity', $segments, true),
            'duplicate_of_lead_id' => Lead::query()
                ->whereNull('duplicate_of_lead_id')
                ->where('created_at', '>=', now()->subDays((int) config('platform.leads.duplicate_window_days')))
                ->where(fn ($q) => $q->where('mobile', $lead->mobile)->when($lead->email, fn ($q) => $q->orWhere('email', $lead->email)))
                ->orderBy('id')
                ->value('id'),
        ]);
    }

    protected function afterCreate(): void
    {
        /** @var Lead $lead */
        $lead = $this->record;
        $user = User::query()->find($this->import->user_id);
        $vendor = $lead->vendor_id ? Vendor::query()->find($lead->vendor_id) : null;
        $basis = (string) ($this->options['consent_basis'] ?? '');

        LeadAttribution::create([
            'lead_id' => $lead->id,
            'is_first_touch' => true,
            'form_key' => 'csv_import',
            'utm_campaign' => $lead->campaign?->code,
            'vendor_code' => $vendor?->code,
            'captured_at' => now(),
        ]);

        LeadStatusHistory::create(['lead_id' => $lead->id, 'from_status' => null, 'to_status' => 'NEW', 'changed_by' => $user?->id, 'reason' => 'Imported from '.$this->import->file_name]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'imported',
            'actor_user_id' => $user?->id,
            'summary' => 'Imported from '.$this->import->file_name,
            'details' => ['import_id' => $this->import->getKey(), 'vendor' => $vendor?->code, 'duplicate_of_lead_id' => $lead->duplicate_of_lead_id],
            'occurred_at' => now(),
        ]);

        $consents = app(ConsentRecorder::class);
        $source = $vendor ? "Supplied by {$vendor->name}. Vendor consent basis: {$vendor->consent_basis}. " : '';
        $consents->record('lead', $lead->id, 'data_processing', true, 'import', mb_substr($source.'Import consent basis: '.$basis, 0, 2000));
        $consents->record('lead', $lead->id, 'calls', (bool) ($this->options['consent_calls'] ?? false), 'import', mb_substr('Phone call consent per import basis: '.$basis, 0, 2000));
        $consents->record('lead', $lead->id, 'whatsapp', (bool) ($this->options['consent_whatsapp'] ?? false), 'import', mb_substr('WhatsApp consent per import basis: '.$basis, 0, 2000));

        app(AuditLogger::class)->record('lead.imported', $lead, new: ['import_id' => $this->import->getKey(), 'vendor' => $vendor?->code], actor: $user);

        $assignTo = $this->options['assign_to_employee_id'] ?? null;
        if ($assignTo !== null && $user?->can('leads.assign')) {
            $employee = Employee::query()->find($assignTo);
            if ($employee !== null) {
                app(LeadAssignmentService::class)->assign($user, $lead, $employee, 'Assigned during import '.$this->import->file_name, 'import');

                return;
            }
        }

        app(LeadAssignmentService::class)->autoAssign($lead);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your lead import has completed and '.Number::format($import->successful_rows).' '.str('row')->plural($import->successful_rows).' imported.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' '.Number::format($failedRowsCount).' '.str('row')->plural($failedRowsCount).' failed to import.';
        }

        return $body;
    }
}
