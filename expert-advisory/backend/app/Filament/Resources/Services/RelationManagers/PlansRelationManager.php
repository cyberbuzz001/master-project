<?php

namespace App\Filament\Resources\Services\RelationManagers;

use App\Domain\Audit\AuditLogger;
use App\Domain\Billing\Money;
use App\Filament\Support\DomainAction;
use App\Models\Plan;
use App\Models\PlanVersion;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Components\Component;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;

class PlansRelationManager extends RelationManager
{
    protected static string $relationship = 'plans';

    protected static ?string $title = 'Plans & prices';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedCurrencyRupee;

    public function table(Table $table): Table
    {
        return $table
            ->description('A price is published once and then frozen. To change it, publish a new version.')
            ->columns([
                TextColumn::make('name')->description(fn (Plan $record) => $record->code),
                TextColumn::make('billing_cycle')->label('Cycle')->formatStateUsing(fn (string $state) => Plan::CYCLES[$state]['label'] ?? $state),
                TextColumn::make('duration_days')->label('Days'),
                TextColumn::make('price')->label('Published price')
                    ->state(fn (Plan $record) => $record->publishedVersion()?->price()->format() ?? 'Not published')
                    ->badge()
                    ->color(fn (string $state) => $state === 'Not published' ? 'warning' : 'success'),
                TextColumn::make('tax')->label('Tax')
                    ->state(fn (Plan $record) => config('billing.tax_codes.'.($record->publishedVersion()?->tax_code ?? '').'.label', '—')),
                IconColumn::make('is_active')->label('Active')->boolean(),
            ])
            ->headerActions([
                CreateAction::make()
                    ->label('New plan')
                    ->visible(fn () => auth()->user()->can('services.manage'))
                    ->schema($this->planSchema())
                    ->mutateDataUsing(function (array $data): array {
                        $data['duration_days'] = $data['duration_days'] ?: (Plan::CYCLES[$data['billing_cycle']]['days'] ?? 0);

                        return $data;
                    }),
            ])
            ->recordActions([
                EditAction::make()->schema($this->planSchema())->visible(fn () => auth()->user()->can('services.manage')),
                Action::make('publishPrice')
                    ->label('Publish a price')
                    ->icon(Heroicon::OutlinedBanknotes)
                    ->color('success')
                    ->visible(fn () => auth()->user()->can('services.manage'))
                    ->schema([
                        TextInput::make('price_rupees')
                            ->label('Price (₹, including nothing else)')
                            ->numeric()
                            ->minValue(1)
                            ->required()
                            ->helperText('Enter rupees; the system stores paise so totals stay exact.'),
                        Select::make('tax_code')
                            ->label('Tax')
                            ->options(collect(config('billing.tax_codes'))->map(fn (array $code) => $code['label'])->all())
                            ->default(config('billing.default_tax_code'))
                            ->required()
                            ->native(false),
                        DatePicker::make('effective_from')->default(now()),
                    ])
                    ->requiresConfirmation()
                    ->modalDescription('The published price is frozen and used on new invoices from now on. Existing invoices are unaffected.')
                    ->action(fn (array $data, Plan $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $this->publishPrice($record, $data),
                        'Price published',
                    )),
                Action::make('priceHistory')
                    ->label('Price history')
                    ->icon(Heroicon::OutlinedClock)
                    ->color('gray')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (Plan $record) => view('filament.billing.price-history', ['plan' => $record])),
            ]);
    }

    private function publishPrice(Plan $plan, array $data): PlanVersion
    {
        return DB::transaction(function () use ($plan, $data): PlanVersion {
            $version = new PlanVersion([
                'plan_id' => $plan->id,
                'version' => ((int) $plan->versions()->max('version')) + 1,
                'base_price_paise' => Money::rupees($data['price_rupees'])->paise,
                'tax_code' => $data['tax_code'],
                'effective_from' => $data['effective_from'] ?? now()->toDateString(),
                'created_by' => auth()->id(),
            ]);
            $version->save();

            $plan->versions()
                ->where('status', PlanVersion::PUBLISHED)
                ->where('id', '!=', $version->id)
                ->each(fn (PlanVersion $current) => $current->forceFill(['status' => PlanVersion::RETIRED])->save());

            $version->forceFill([
                'status' => PlanVersion::PUBLISHED,
                'published_by' => auth()->id(),
                'published_at' => now(),
            ])->save();

            app(AuditLogger::class)->record('plan_price.published', $version, new: [
                'plan' => $plan->code, 'version' => $version->version, 'base_price_paise' => $version->base_price_paise,
            ]);

            return $version;
        });
    }

    /**
     * @return list<Component>
     */
    private function planSchema(): array
    {
        return [
            TextInput::make('code')->required()->maxLength(64),
            TextInput::make('name')->required()->maxLength(255),
            Select::make('billing_cycle')
                ->options(collect(Plan::CYCLES)->map(fn (array $cycle) => $cycle['label'])->all())
                ->default('quarterly')
                ->required()
                ->native(false),
            TextInput::make('duration_days')->label('Access days')->integer()->minValue(0)->maxValue(1825)
                ->helperText('Leave blank to use the cycle default.'),
            Toggle::make('is_active')->default(true),
        ];
    }
}
