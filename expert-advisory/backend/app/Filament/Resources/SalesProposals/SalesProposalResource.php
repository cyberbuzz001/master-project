<?php

namespace App\Filament\Resources\SalesProposals;

use App\Domain\Billing\Money;
use App\Filament\Resources\SalesProposals\Pages\ManageSalesProposals;
use App\Models\Client;
use App\Models\Lead;
use App\Models\PaymentInstallment;
use App\Models\PlanVersion;
use App\Models\SalesProposal;
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
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Support\Str;
use UnitEnum;

class SalesProposalResource extends Resource
{
    protected static ?string $model = SalesProposal::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentCheck;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?string $navigationLabel = 'Proposals & closures';

    protected static ?int $navigationSort = 4;

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('proposal_number')
                ->label('Proposal #')
                ->default(fn () => 'PROP-' . date('ymd') . '-' . strtoupper(Str::random(4)))
                ->required()
                ->readOnly(),
            Select::make('lead_id')
                ->label('Lead (Prospect)')
                ->options(fn () => Lead::query()->latest('id')->limit(150)->pluck('full_name', 'id'))
                ->searchable(),
            Select::make('client_id')
                ->label('Or Client (Existing)')
                ->options(fn () => Client::query()->latest('id')->limit(150)->pluck('full_name', 'id'))
                ->searchable(),
            Select::make('plan_version_id')
                ->label('Base Plan / Service Package')
                ->options(fn () => PlanVersion::query()
                    ->where('status', PlanVersion::PUBLISHED)
                    ->with('plan.service')
                    ->get()
                    ->mapWithKeys(fn (PlanVersion $v) => [$v->id => ($v->plan?->service?->name ?? 'Advisory') . ' — ' . ($v->plan?->name ?? 'Plan') . ' (' . $v->price()->format() . ')']))
                ->searchable(),
            TextInput::make('package_name')
                ->label('Package title')
                ->placeholder('E.g., Index Momentum Platinum — 6 Months')
                ->required(),
            TextInput::make('duration_days')
                ->label('Service duration (Days)')
                ->numeric()
                ->default(90)
                ->required(),
            TextInput::make('approved_service_fee_rupees')
                ->label('Standard fee (₹)')
                ->numeric()
                ->required()
                ->afterStateHydrated(fn ($component, ?SalesProposal $record) => $record ? $component->state($record->serviceFee()->rupees) : null),
            TextInput::make('registration_amount_rupees')
                ->label('Initial token / registration (₹)')
                ->numeric()
                ->default(0)
                ->afterStateHydrated(fn ($component, ?SalesProposal $record) => $record ? $component->state($record->registrationAmount()->rupees) : null),
            TextInput::make('discount_amount_rupees')
                ->label('Approved discount (₹)')
                ->numeric()
                ->default(0)
                ->afterStateHydrated(fn ($component, ?SalesProposal $record) => $record ? $component->state($record->discount()->rupees) : null),
            TextInput::make('final_agreed_amount_rupees')
                ->label('Final payable fee (₹)')
                ->numeric()
                ->required()
                ->afterStateHydrated(fn ($component, ?SalesProposal $record) => $record ? $component->state($record->finalAmount()->rupees) : null),
            TextInput::make('installment_count')
                ->label('Number of installments')
                ->numeric()
                ->default(1)
                ->minValue(1)
                ->maxValue(6)
                ->required(),
            DatePicker::make('expires_at')
                ->label('Proposal valid until')
                ->default(today()->addDays(7))
                ->required(),
            Select::make('status')
                ->options([
                    'draft' => 'Draft',
                    'sent' => 'Sent to Prospect',
                    'approved' => 'Internally Approved',
                    'accepted' => 'Accepted by Prospect',
                    'rejected' => 'Rejected',
                    'expired' => 'Expired',
                ])
                ->default('sent')
                ->required(),
            Textarea::make('service_scope')
                ->label('Service scope & delivery expectations')
                ->placeholder('Daily live trade setups on Telegram/WhatsApp, 1-on-1 advisor desk support, max 2 active positions.')
                ->rows(2),
            Textarea::make('payment_terms')
                ->label('Payment terms & milestone commitments')
                ->placeholder('Installment 1: 50% upfront. Installment 2: Remaining 50% within 15 trading days.')
                ->rows(2),
            Textarea::make('terms_and_disclaimers')
                ->label('Risk disclosures & SEBI advisory disclaimers')
                ->default('Investment in securities is subject to market risks. Read all scheme related documents carefully. Past performance does not guarantee future returns. No profit sharing or assured return schemes are offered.')
                ->rows(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('proposal_number')->label('Proposal #')->fontFamily('mono')->weight('bold'),
                TextColumn::make('target_name')
                    ->label('Prospect / Client')
                    ->state(fn (SalesProposal $r) => $r->lead?->full_name ?? $r->client?->full_name ?? '—')
                    ->description(fn (SalesProposal $r) => $r->lead?->mobile ?? $r->client?->mobile ?? ''),
                TextColumn::make('package_name')->label('Package')->searchable(),
                TextColumn::make('duration_days')->label('Duration')->formatStateUsing(fn ($s) => "{$s} days"),
                TextColumn::make('final_amount')
                    ->label('Net Agreed Fee')
                    ->state(fn (SalesProposal $r) => $r->finalAmount()->format())
                    ->weight('bold')
                    ->color('success'),
                TextColumn::make('installment_count')->label('Installments')->alignCenter(),
                TextColumn::make('status')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'accepted' => 'success',
                        'approved' => 'primary',
                        'sent' => 'info',
                        'rejected', 'expired' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('expires_at')->date('d M Y')->label('Valid till'),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'draft' => 'Draft',
                    'sent' => 'Sent',
                    'approved' => 'Approved',
                    'accepted' => 'Accepted',
                    'rejected' => 'Rejected',
                    'expired' => 'Expired',
                ]),
            ])
            ->recordActions([
                EditAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        if (isset($data['approved_service_fee_rupees'])) {
                            $data['approved_service_fee_paise'] = Money::rupees((float) $data['approved_service_fee_rupees'])->paise;
                        }
                        if (isset($data['registration_amount_rupees'])) {
                            $data['registration_amount_paise'] = Money::rupees((float) $data['registration_amount_rupees'])->paise;
                        }
                        if (isset($data['discount_amount_rupees'])) {
                            $data['discount_amount_paise'] = Money::rupees((float) $data['discount_amount_rupees'])->paise;
                        }
                        if (isset($data['final_agreed_amount_rupees'])) {
                            $data['final_agreed_amount_paise'] = Money::rupees((float) $data['final_agreed_amount_rupees'])->paise;
                        }
                        unset($data['approved_service_fee_rupees'], $data['registration_amount_rupees'], $data['discount_amount_rupees'], $data['final_agreed_amount_rupees']);
                        return $data;
                    }),
                Action::make('accept')
                    ->label('Mark Accepted')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (SalesProposal $r) => in_array($r->status, ['draft', 'sent', 'approved'], true))
                    ->action(function (SalesProposal $r) {
                        $r->update([
                            'status' => 'accepted',
                            'accepted_at' => now(),
                        ]);
                        if ($r->lead) {
                            $r->lead->update(['status' => 'EXPECTED_PAYMENT']);
                        }
                        Notification::make()->success()->title('Proposal marked as accepted! Lead updated to Expected Payment.')->send();
                    }),
                Action::make('generate_installments')
                    ->label('Create Installments')
                    ->icon(Heroicon::OutlinedCalendarDays)
                    ->color('primary')
                    ->visible(fn (SalesProposal $r) => $r->client_id !== null && $r->installments()->count() === 0)
                    ->requiresConfirmation()
                    ->action(function (SalesProposal $r) {
                        $count = max(1, (int) $r->installment_count);
                        $totalPaise = $r->final_agreed_amount_paise;
                        $perInstallment = (int) floor($totalPaise / $count);
                        $remainder = $totalPaise - ($perInstallment * $count);

                        for ($i = 1; $i <= $count; $i++) {
                            $amount = $perInstallment + ($i === 1 ? $remainder : 0);
                            $dueDate = today()->addDays(($i - 1) * 30);

                            PaymentInstallment::create([
                                'client_id' => $r->client_id,
                                'proposal_id' => $r->id,
                                'installment_number' => $i,
                                'amount_paise' => $amount,
                                'amount_verified_paise' => 0,
                                'due_date' => $dueDate,
                                'status' => $i === 1 ? 'due' : 'promised',
                                'notes' => "Auto-scheduled from Proposal {$r->proposal_number} (Installment {$i} of {$count})",
                            ]);
                        }

                        Notification::make()->success()->title("Generated {$count} installment schedule entries for Client.")->send();
                    }),
            ])
            ->headerActions([
                CreateAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        $data['employee_id'] = auth()->user()->employee?->id;
                        $data['created_by'] = auth()->id();
                        if (isset($data['approved_service_fee_rupees'])) {
                            $data['approved_service_fee_paise'] = Money::rupees((float) $data['approved_service_fee_rupees'])->paise;
                        }
                        if (isset($data['registration_amount_rupees'])) {
                            $data['registration_amount_paise'] = Money::rupees((float) $data['registration_amount_rupees'])->paise;
                        }
                        if (isset($data['discount_amount_rupees'])) {
                            $data['discount_amount_paise'] = Money::rupees((float) $data['discount_amount_rupees'])->paise;
                        }
                        if (isset($data['final_agreed_amount_rupees'])) {
                            $data['final_agreed_amount_paise'] = Money::rupees((float) $data['final_agreed_amount_rupees'])->paise;
                        }
                        unset($data['approved_service_fee_rupees'], $data['registration_amount_rupees'], $data['discount_amount_rupees'], $data['final_agreed_amount_rupees']);
                        return $data;
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageSalesProposals::route('/')];
    }
}
