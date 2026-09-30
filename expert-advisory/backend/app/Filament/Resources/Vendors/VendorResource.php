<?php

namespace App\Filament\Resources\Vendors;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\Vendors\Pages\ManageVendors;
use App\Models\Vendor;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

/**
 * Vendor quality is shown as evidence (counts and rates), never as an automatic verdict.
 */
class VendorResource extends Resource
{
    protected static ?string $model = Vendor::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBuildingStorefront;

    protected static string|UnitEnum|null $navigationGroup = 'Marketing';

    protected static ?int $navigationSort = 2;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount([
            'leads',
            'leads as contacted_count' => fn (Builder $q) => $q->whereNotNull('last_contacted_at'),
            'leads as invalid_count' => fn (Builder $q) => $q->whereIn('status', ['INVALID', 'DND']),
            'leads as duplicate_count' => fn (Builder $q) => $q->whereNotNull('duplicate_of_lead_id'),
            'leads as trials_count' => fn (Builder $q) => $q->whereIn('status', ['FREE_TRIAL', 'EXPECTED_PAYMENT']),
            'leads as won_count' => fn (Builder $q) => $q->whereIn('status', ['PAID', 'CONVERTED']),
        ]);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->columns(2)->components([
            TextInput::make('name')->required()->maxLength(255),
            TextInput::make('code')->required()->alphaDash()->maxLength(48)->unique(ignoreRecord: true)->helperText('Used as ?vendor= in links and on imports.'),
            TextInput::make('contact_name')->maxLength(255),
            TextInput::make('contact_email')->email()->maxLength(255),
            TextInput::make('contact_phone')->tel()->maxLength(32),
            TextInput::make('cost_per_lead')->numeric()->minValue(0)->prefix('₹'),
            Select::make('status')->options(['active' => 'Active', 'paused' => 'Paused', 'terminated' => 'Terminated'])->default('active')->required()->native(false),
            Textarea::make('consent_basis')
                ->label('How does this vendor obtain consent?')
                ->required()
                ->minLength(20)
                ->rows(3)
                ->helperText('Required before any of their leads can be imported. Attach the agreement reference.')
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        $rate = fn (int $part, int $total) => $total > 0 ? round($part / $total * 100, 1).'%' : '—';

        return $table
            ->defaultSort('name')
            ->columns([
                TextColumn::make('name')->searchable()->weight('medium')->description(fn (Vendor $record) => $record->code),
                TextColumn::make('status')->badge()->color(fn (string $state) => $state === 'active' ? 'success' : 'gray'),
                TextColumn::make('leads_count')->label('Leads')->numeric()->sortable(),
                TextColumn::make('contacted')->label('Contacted')->state(fn (Vendor $record) => $rate($record->contacted_count, $record->leads_count)),
                TextColumn::make('invalid')->label('Invalid / DND')->state(fn (Vendor $record) => $rate($record->invalid_count, $record->leads_count))
                    ->color(fn (Vendor $record) => $record->leads_count >= 20 && $record->invalid_count / max(1, $record->leads_count) > 0.25 ? 'danger' : null),
                TextColumn::make('duplicates')->label('Duplicates')->state(fn (Vendor $record) => $rate($record->duplicate_count, $record->leads_count)),
                TextColumn::make('trials_count')->label('Trials / expected')->numeric(),
                TextColumn::make('won')->label('Lead → paid')->state(fn (Vendor $record) => $rate($record->won_count, $record->leads_count)),
                TextColumn::make('cost_per_lead')->money('INR')->toggleable(),
                TextColumn::make('consent_basis')->label('Consent basis')->limit(40)->placeholder('Missing — imports blocked')->toggleable(),
            ])
            ->recordActions([
                EditAction::make()->after(fn (Vendor $record) => app(AuditLogger::class)->record('vendor.updated', $record, new: $record->getChanges())),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageVendors::route('/')];
    }
}
