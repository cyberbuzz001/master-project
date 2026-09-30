<?php

namespace App\Filament\Resources\Campaigns;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\Campaigns\Pages\ManageCampaigns;
use App\Models\Campaign;
use App\Models\Vendor;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;
use UnitEnum;

class CampaignResource extends Resource
{
    protected static ?string $model = Campaign::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedMegaphone;

    protected static string|UnitEnum|null $navigationGroup = 'Marketing';

    protected static ?int $navigationSort = 1;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->with('vendor:id,name')
            ->withCount([
                'leads',
                'leads as trials_count' => fn (Builder $q) => $q->whereIn('status', ['FREE_TRIAL', 'EXPECTED_PAYMENT']),
                'leads as won_count' => fn (Builder $q) => $q->whereIn('status', ['PAID', 'CONVERTED']),
                'leads as invalid_count' => fn (Builder $q) => $q->whereIn('status', ['INVALID', 'DND']),
            ]);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->columns(2)->components([
            TextInput::make('name')->required()->maxLength(255),
            TextInput::make('code')
                ->label('Campaign code (utm_campaign)')
                ->required()
                ->alphaDash()
                ->maxLength(64)
                ->unique(ignoreRecord: true, modifyRuleUsing: fn (Unique $rule) => $rule)
                ->helperText('Used in tracking links; cannot contain spaces.'),
            Select::make('channel')->options(Campaign::CHANNELS)->native(false),
            Select::make('vendor_id')->label('Vendor')->options(fn () => Vendor::query()->orderBy('name')->pluck('name', 'id'))->searchable(),
            TextInput::make('landing_page_url')->url()->maxLength(2048)->columnSpanFull(),
            TextInput::make('budget')->numeric()->minValue(0)->prefix('₹'),
            Select::make('status')->options(['active' => 'Active', 'paused' => 'Paused', 'ended' => 'Ended'])->default('active')->required()->native(false),
            DatePicker::make('starts_on'),
            DatePicker::make('ends_on')->afterOrEqual('starts_on'),
            Textarea::make('notes')->rows(2)->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        $frontend = config('platform.frontend_url');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('name')->searchable()->weight('medium')->description(fn (Campaign $record) => $record->code),
                TextColumn::make('channel')->badge()->color('gray')->formatStateUsing(fn (?string $state) => Campaign::CHANNELS[$state] ?? $state),
                TextColumn::make('status')->badge()->color(fn (string $state) => $state === 'active' ? 'success' : 'gray'),
                TextColumn::make('leads_count')->label('Leads')->numeric()->sortable(),
                TextColumn::make('trials_count')->label('Trials / expected')->numeric(),
                TextColumn::make('won_count')->label('Paid')->numeric(),
                TextColumn::make('conversion')
                    ->label('Lead → paid')
                    ->state(fn (Campaign $record) => $record->leads_count > 0 ? round($record->won_count / $record->leads_count * 100, 1).'%' : '—'),
                TextColumn::make('invalid_rate')
                    ->label('Invalid / DND')
                    ->state(fn (Campaign $record) => $record->leads_count > 0 ? round($record->invalid_count / $record->leads_count * 100, 1).'%' : '—')
                    ->toggleable(),
                TextColumn::make('budget')->money('INR')->toggleable(),
                TextColumn::make('tracking_link')
                    ->label('Tracking link')
                    ->state(fn (Campaign $record) => $frontend.'/contact?utm_source='.urlencode((string) ($record->channel ?? 'campaign')).'&utm_medium=campaign&utm_campaign='.urlencode($record->code))
                    ->copyable()
                    ->limit(40)
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')->options(['active' => 'Active', 'paused' => 'Paused', 'ended' => 'Ended']),
                SelectFilter::make('channel')->options(Campaign::CHANNELS),
            ])
            ->recordActions([
                EditAction::make()->after(fn (Campaign $record) => app(AuditLogger::class)->record('campaign.updated', $record, new: $record->getChanges())),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageCampaigns::route('/')];
    }
}
