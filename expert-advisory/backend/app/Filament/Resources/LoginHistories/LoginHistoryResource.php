<?php

namespace App\Filament\Resources\LoginHistories;

use App\Filament\Resources\LoginHistories\Pages\ManageLoginHistories;
use App\Models\LoginHistory;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class LoginHistoryResource extends Resource
{
    protected static ?string $model = LoginHistory::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedFingerPrint;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 4;

    protected static ?string $navigationLabel = 'Sign-in activity';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('users.view');
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('user:id,name');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('created_at')->label('Time (IST)')->dateTime('d M Y, h:i:s A', config('platform.timezone_display')),
                TextColumn::make('email_attempted')->label('Account')->searchable()->description(fn (LoginHistory $record) => $record->user?->name),
                TextColumn::make('outcome')->badge()->color(fn (string $state) => match ($state) {
                    LoginHistory::SUCCESS => 'success',
                    LoginHistory::TWO_FACTOR_REQUIRED => 'info',
                    default => 'danger',
                }),
                TextColumn::make('ip')->label('IP')->fontFamily('mono')->searchable(),
                TextColumn::make('user_agent')->label('Device')->limit(50)->toggleable(),
            ])
            ->filters([
                SelectFilter::make('outcome')->options([
                    LoginHistory::SUCCESS => 'Success', LoginHistory::FAILED => 'Failed', LoginHistory::LOCKED => 'Locked',
                    LoginHistory::INACTIVE => 'Inactive account', LoginHistory::TWO_FACTOR_REQUIRED => '2FA prompted', LoginHistory::TWO_FACTOR_FAILED => '2FA failed',
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageLoginHistories::route('/')];
    }
}
