<?php

namespace App\Filament\Exports;

use App\Domain\Crm\LeadStatus;
use App\Models\Lead;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Str;

class LeadExporter extends Exporter
{
    protected static ?string $model = Lead::class;

    public static function getColumns(): array
    {
        $tz = config('platform.timezone_display');

        return [
            ExportColumn::make('uuid')->label('Lead ID'),
            ExportColumn::make('full_name')->label('Name'),
            ExportColumn::make('mobile'),
            ExportColumn::make('email'),
            ExportColumn::make('city'),
            ExportColumn::make('state'),
            ExportColumn::make('status')->formatStateUsing(fn (string $state) => LeadStatus::tryFrom($state)?->getLabel() ?? $state),
            ExportColumn::make('preferred_segments')->label('Markets')->listAsJson(false),
            ExportColumn::make('capital_range'),
            ExportColumn::make('source.name')->label('Source'),
            ExportColumn::make('campaign.name')->label('Campaign'),
            ExportColumn::make('vendor.name')->label('Vendor'),
            ExportColumn::make('assignedEmployee.user.name')->label('Owner'),
            ExportColumn::make('last_contacted_at')->label('Last contact')->formatStateUsing(fn ($state) => $state?->timezone($tz)->format('Y-m-d H:i')),
            ExportColumn::make('next_followup_at')->label('Next follow-up')->formatStateUsing(fn ($state) => $state?->timezone($tz)->format('Y-m-d H:i')),
            ExportColumn::make('created_at')->label('Received')->formatStateUsing(fn ($state) => $state?->timezone($tz)->format('Y-m-d H:i')),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your lead export has completed and '.Str::of('row')->counted($export->successful_rows).' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' '.Str::of('row')->counted($failedRowsCount).' failed to export.';
        }

        return $body;
    }
}
