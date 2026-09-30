<?php

namespace App\Filament\Resources\ReferralCodes;

use App\Filament\Resources\ReferralCodes\Pages\ManageReferralCodes;
use App\Models\Employee;
use App\Models\Lead;
use App\Models\ReferralCode;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use UnitEnum;

/**
 * Referral links for attribution. Rewards stay disabled until compliance approves a reward policy.
 */
class ReferralCodeResource extends Resource
{
    protected static ?string $model = ReferralCode::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedLink;

    protected static string|UnitEnum|null $navigationGroup = 'Marketing';

    protected static ?int $navigationSort = 3;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('label')->required()->maxLength(255),
            TextInput::make('code')->required()->alphaDash()->maxLength(64)->unique(ignoreRecord: true)->disabledOn('edit'),
            Select::make('owner_employee_id')
                ->label('Owner')
                ->options(fn () => Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                ->searchable(),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        $frontend = config('platform.frontend_url');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('label')->searchable()->weight('medium'),
                TextColumn::make('code')->fontFamily('mono'),
                TextColumn::make('owner.user.name')->label('Owner')->placeholder('—'),
                TextColumn::make('leads')->label('Leads')->state(fn (ReferralCode $record) => Lead::query()->where('referral_code', $record->code)->count()),
                IconColumn::make('is_active')->boolean(),
                IconColumn::make('reward_enabled')->label('Rewards')->boolean()->tooltip('Enabled only after compliance approval'),
                TextColumn::make('link')->state(fn (ReferralCode $record) => $frontend.'/contact?ref='.$record->code)->copyable()->limit(36),
            ])
            ->recordActions([EditAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageReferralCodes::route('/')];
    }
}
