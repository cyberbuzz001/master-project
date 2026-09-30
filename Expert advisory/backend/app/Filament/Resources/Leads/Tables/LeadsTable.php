<?php

namespace App\Filament\Resources\Leads\Tables;

use App\Domain\Crm\LeadStatus;
use App\Filament\Exports\LeadExporter;
use App\Filament\Imports\LeadImporter;
use App\Filament\Resources\Leads\Actions\LeadActions;
use App\Filament\Resources\Leads\Schemas\LeadForm;
use App\Models\Campaign;
use App\Models\Employee;
use App\Models\Lead;
use App\Models\LeadSource;
use App\Models\Vendor;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\ExportBulkAction;
use Filament\Actions\ImportAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class LeadsTable
{
    public static function configure(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('created_at', 'desc')
            ->striped()
            ->columns([
                TextColumn::make('full_name')
                    ->label('Lead')
                    ->searchable()
                    ->sortable()
                    ->weight('medium')
                    ->description(fn (Lead $record) => $record->mobile)
                    ->icon(fn (Lead $record) => $record->escalated_at ? 'heroicon-s-exclamation-triangle' : null)
                    ->iconColor('danger')
                    ->tooltip(fn (Lead $record) => $record->escalated_at ? 'Escalated — needs attention' : null),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => LeadStatus::tryFrom($state)?->getLabel() ?? $state)
                    ->color(fn (string $state) => LeadStatus::tryFrom($state)?->getColor() ?? 'gray')
                    ->sortable(),
                TextColumn::make('preferred_segments')
                    ->label('Markets')
                    ->badge()
                    ->color('gray')
                    ->formatStateUsing(fn (string $state) => LeadForm::SEGMENTS[$state] ?? $state)
                    ->toggleable(),
                TextColumn::make('assignedEmployee.user.name')->label('Owner')->placeholder('Unassigned')->toggleable(),
                TextColumn::make('next_followup_at')
                    ->label('Next follow-up')
                    ->dateTime('d M, h:i A', $tz)
                    ->sortable()
                    ->color(fn (Lead $record) => $record->next_followup_at?->isPast() ? 'danger' : null)
                    ->placeholder('—'),
                TextColumn::make('last_contacted_at')->label('Last contact')->since($tz)->sortable()->placeholder('Never')->toggleable(),
                TextColumn::make('source.name')->label('Source')->toggleable(),
                TextColumn::make('campaign.name')->label('Campaign')->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('city')->toggleable(isToggledHiddenByDefault: true),
                IconColumn::make('duplicate_of_lead_id')
                    ->label('Dup.')
                    ->icon(fn ($state) => $state ? 'heroicon-o-document-duplicate' : null)
                    ->color('warning')
                    ->tooltip('Possible duplicate')
                    ->toggleable(),
                TextColumn::make('created_at')->label('Received')->dateTime('d M Y', $tz)->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')->multiple()->options(LeadStatus::options()),
                SelectFilter::make('lead_source_id')->label('Source')->options(fn () => LeadSource::query()->orderBy('name')->pluck('name', 'id')),
                SelectFilter::make('campaign_id')->label('Campaign')->options(fn () => Campaign::query()->orderByDesc('id')->pluck('name', 'id'))->searchable(),
                SelectFilter::make('vendor_id')->label('Vendor')->options(fn () => Vendor::query()->orderBy('name')->pluck('name', 'id'))->searchable(),
                SelectFilter::make('assigned_employee_id')
                    ->label('Owner')
                    ->visible(fn () => auth()->user()->canAny(['leads.view_team', 'leads.view_all']))
                    ->options(fn () => Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()])),
                TernaryFilter::make('unassigned')
                    ->label('Ownership')
                    ->placeholder('All')
                    ->trueLabel('Unassigned only')
                    ->falseLabel('Assigned only')
                    ->queries(true: fn (Builder $query) => $query->whereNull('assigned_employee_id'), false: fn (Builder $query) => $query->whereNotNull('assigned_employee_id'))
                    ->visible(fn () => auth()->user()->can('leads.view_all')),
                Filter::make('followup_due')
                    ->label('Follow-up due by today')
                    ->query(fn (Builder $query) => $query->whereNotNull('next_followup_at')->where('next_followup_at', '<=', now($tz)->endOfDay()->utc())),
                Filter::make('escalated')->label('Escalated')->query(fn (Builder $query) => $query->whereNotNull('escalated_at')),
                Filter::make('duplicates')->label('Possible duplicates')->query(fn (Builder $query) => $query->whereNotNull('duplicate_of_lead_id')),
            ])
            ->recordActions([
                ActionGroup::make([
                    ViewAction::make(),
                    LeadActions::logCall(),
                    LeadActions::scheduleFollowup(),
                    LeadActions::changeStatus(),
                    LeadActions::assign(),
                ]),
            ])
            ->headerActions([
                ImportAction::make()
                    ->label('Import CSV')
                    ->importer(LeadImporter::class)
                    ->maxRows(20000)
                    ->chunkSize(200)
                    ->visible(fn () => auth()->user()->can('leads.import')),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    LeadActions::bulkAssign(),
                    ExportBulkAction::make()->exporter(LeadExporter::class)->visible(fn () => auth()->user()->can('leads.export')),
                ]),
            ]);
    }
}
