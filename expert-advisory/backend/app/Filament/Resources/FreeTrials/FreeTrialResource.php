<?php

namespace App\Filament\Resources\FreeTrials;

use App\Filament\Resources\FreeTrials\Pages\ManageFreeTrials;
use App\Models\FreeTrial;
use App\Models\Lead;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use UnitEnum;

class FreeTrialResource extends Resource
{
    protected static ?string $model = FreeTrial::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSparkles;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?string $navigationLabel = 'Demo / Free trials';

    protected static ?int $navigationSort = 3;

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('lead_id')
                ->label('Lead')
                ->options(fn () => Lead::query()->latest('id')->limit(100)->pluck('full_name', 'id'))
                ->searchable()
                ->required(),
            Select::make('trial_type')
                ->label('Service segment')
                ->options([
                    'equity' => 'Equity Intraday',
                    'index_options' => 'Nifty / BankNifty Options',
                    'commodity' => 'MCX Commodity',
                    'combo' => 'Full Combo Trial',
                ])
                ->default('index_options')
                ->required(),
            Textarea::make('scope_description')
                ->label('Trial scope & limitations')
                ->placeholder('2 trading sessions; 1 recommendation per session; strict stop-loss adherence.')
                ->rows(2),
            DatePicker::make('start_date')->label('Start date')->default(today())->required(),
            DatePicker::make('end_date')->label('End date')->default(today()->addDays(2))->required(),
            DatePicker::make('interim_checkin_date')->label('Interim check-in')->default(today()->addDay()),
            DatePicker::make('review_meeting_date')->label('Trial review call')->default(today()->addDays(2)),
            Select::make('status')
                ->options([
                    'requested' => 'Requested',
                    'approved' => 'Approved',
                    'active' => 'Active',
                    'completed' => 'Completed',
                    'converted' => 'Converted to Paid',
                    'dropped' => 'Dropped / Lost',
                    'cancelled' => 'Cancelled',
                ])
                ->default('active')
                ->required(),
            Textarea::make('client_feedback')->label('Client trial feedback')->rows(2),
            Select::make('drop_off_reason')
                ->label('Drop-off reason (if dropped)')
                ->options([
                    'no_response' => 'No Response to Review Call',
                    'no_perceived_value' => 'No Perceived Value',
                    'trust_concern' => 'Trust / Authenticity Concern',
                    'price_concern' => 'Pricing / Fee Too High',
                    'payment_issue' => 'Payment Mode / Bank Issue',
                    'poor_experience' => 'Poor Execution / Slippage',
                    'service_mismatch' => 'Service Not Suitable for Capital',
                    'not_interested' => 'Not Interested in Trading',
                    'other' => 'Other Stated Reason',
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('trial_code')->label('Trial ID')->fontFamily('mono')->weight('bold'),
                TextColumn::make('lead.full_name')->label('Lead')->searchable()->description(fn (FreeTrial $r) => $r->lead?->mobile),
                TextColumn::make('trial_type')->badge()->color('info')
                    ->formatStateUsing(fn ($s) => match ($s) {
                        'equity' => 'Equity',
                        'index_options' => 'Index F&O',
                        'commodity' => 'Commodity',
                        default => 'Combo',
                    }),
                TextColumn::make('start_date')->date('d M Y')->label('Starts'),
                TextColumn::make('end_date')->date('d M Y')->label('Ends')
                    ->color(fn (FreeTrial $r) => $r->end_date <= today() && $r->status === 'active' ? 'danger' : null),
                TextColumn::make('status')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'converted' => 'success',
                        'active' => 'primary',
                        'approved' => 'info',
                        'completed' => 'warning',
                        'dropped', 'cancelled' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('employee.user.name')->label('Advisor')->placeholder('Unassigned'),
                TextColumn::make('drop_off_reason')->label('Drop reason')->placeholder('—')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'active' => 'Active Trials',
                    'approved' => 'Approved (Awaiting Start)',
                    'completed' => 'Completed (Review Due)',
                    'converted' => 'Converted to Paid',
                    'dropped' => 'Dropped',
                ]),
                Filter::make('ending_soon')
                    ->label('Ending in next 48h')
                    ->query(fn (Builder $q) => $q->where('status', 'active')->whereBetween('end_date', [today(), today()->addDays(2)])),
                Filter::make('overdue_review')
                    ->label('Review call overdue')
                    ->query(fn (Builder $q) => $q->whereIn('status', ['active', 'completed'])->where('review_meeting_date', '<', today())),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('convert')
                    ->label('Convert')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->visible(fn (FreeTrial $r) => in_array($r->status, ['active', 'completed'], true))
                    ->requiresConfirmation()
                    ->action(function (FreeTrial $r) {
                        $r->update(['status' => 'converted']);
                        if ($r->lead) {
                            $r->lead->update(['status' => 'EXPECTED_PAYMENT']);
                        }
                        Notification::make()->success()->title('Trial marked as converted! Lead status updated to Expected Payment.')->send();
                    }),
            ])
            ->headerActions([
                CreateAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        $data['trial_code'] = 'TR-' . strtoupper(Str::random(6));
                        $data['employee_id'] = auth()->user()->employee?->id;
                        $data['approved_by'] = auth()->id();
                        $data['approved_at'] = now();
                        return $data;
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageFreeTrials::route('/')];
    }
}
