<?php

namespace App\Filament\Resources\Clients\Tables;

use App\Domain\Onboarding\OnboardingService;
use App\Filament\Resources\Clients\Actions\ClientActions;
use App\Models\Client;
use Filament\Actions\ActionGroup;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ClientsTable
{
    public const STATUS_COLORS = [
        OnboardingService::LEAD => 'gray',
        OnboardingService::ONBOARDING => 'warning',
        OnboardingService::ACTIVE => 'success',
        OnboardingService::ON_HOLD => 'danger',
        OnboardingService::CLOSED => 'gray',
    ];

    public static function configure(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('client_code')->label('Code')->searchable()->sortable()->toggleable(),
                TextColumn::make('full_name')->label('Client')->searchable()->weight('medium')
                    ->description(fn (Client $record) => $record->mobile),
                TextColumn::make('onboarding_status')->label('Stage')->badge()
                    ->formatStateUsing(fn (string $state) => str($state)->lower()->headline())
                    ->color(fn (string $state) => self::STATUS_COLORS[$state] ?? 'gray'),
                TextColumn::make('kyc_status')->label('KYC')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'verified' => 'success',
                        'rejected' => 'danger',
                        'in_review' => 'warning',
                        default => 'gray',
                    }),
                TextColumn::make('riskProfile.risk_category')->label('Risk category')->badge()->color('info')->placeholder('Not assessed'),
                TextColumn::make('relationshipManager.user.name')->label('Relationship manager')->placeholder('Unassigned')->toggleable(),
                TextColumn::make('converted_at')->label('Client since')->date('d M Y', $tz)->sortable()->toggleable(),
            ])
            ->filters([
                SelectFilter::make('onboarding_status')->label('Stage')->options(array_combine(
                    array_keys(self::STATUS_COLORS),
                    array_map(fn (string $status) => str($status)->lower()->headline()->toString(), array_keys(self::STATUS_COLORS)),
                )),
                SelectFilter::make('kyc_status')->label('KYC')->options([
                    'pending' => 'Pending', 'in_review' => 'In review', 'verified' => 'Verified', 'rejected' => 'Rejected',
                ]),
                TernaryFilter::make('risk_profile_id')->label('Risk profile')
                    ->placeholder('Any')->trueLabel('Completed')->falseLabel('Missing')
                    ->queries(
                        true: fn (Builder $query) => $query->whereNotNull('risk_profile_id'),
                        false: fn (Builder $query) => $query->whereNull('risk_profile_id'),
                        blank: fn (Builder $query) => $query,
                    ),
            ])
            ->recordActions([
                ViewAction::make(),
                ActionGroup::make([
                    ClientActions::activate(),
                    ClientActions::hold(),
                    ClientActions::close(),
                ]),
            ]);
    }
}
