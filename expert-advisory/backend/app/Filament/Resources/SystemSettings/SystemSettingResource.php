<?php

namespace App\Filament\Resources\SystemSettings;

use App\Domain\Platform\Settings;
use App\Filament\Resources\SystemSettings\Pages\ManageSystemSettings;
use App\Filament\Support\DomainAction;
use App\Models\SystemSetting;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use UnitEnum;

class SystemSettingResource extends Resource
{
    protected static ?string $model = SystemSetting::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Settings';

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

    public static function table(Table $table): Table
    {
        $settings = app(Settings::class);

        return $table
            ->defaultSort('key')
            ->paginated([50, 100])
            ->columns([
                TextColumn::make('key')->label('Setting')->searchable()
                    ->formatStateUsing(fn (string $state) => Str::headline(Str::after($state, '.')))
                    ->description(fn (SystemSetting $record) => $record->key),
                TextColumn::make('display_value')->label('Value')->wrap()
                    ->state(fn (SystemSetting $record) => $record->is_secret ? ($record->getRawOriginal('value') ? '••••••••' : null) : $settings->get($record->key))
                    ->formatStateUsing(fn ($state) => is_bool($state) ? ($state ? 'Yes' : 'No') : (is_array($state) ? json_encode($state) : (string) $state))
                    ->placeholder('Not set'),
                IconColumn::make('is_public')->label('Public')->boolean(),
                TextColumn::make('verification')->badge()
                    ->state(fn (SystemSetting $record) => ! $record->requires_verification ? 'Not required' : ($record->verified_at ? 'Verified' : 'Unverified'))
                    ->color(fn (string $state) => match ($state) {
                        'Verified' => 'success',
                        'Unverified' => 'warning',
                        default => 'gray',
                    }),
            ])
            ->filters([
                SelectFilter::make('group')->options(fn () => SystemSetting::query()->distinct()->orderBy('group')->pluck('group', 'group')),
            ])
            ->recordActions([
                Action::make('change')
                    ->label('Change')
                    ->icon(Heroicon::OutlinedPencilSquare)
                    ->visible(fn (SystemSetting $record) => ! $record->is_secret && auth()->user()->can('settings.manage'))
                    ->modalDescription(fn (SystemSetting $record) => $record->requires_verification ? 'Changing this value removes its verification until someone else verifies it again.' : null)
                    ->fillForm(fn (SystemSetting $record) => ['value' => $settings->get($record->key)])
                    ->schema(fn (SystemSetting $record) => [
                        match ($record->type) {
                            'bool' => Toggle::make('value'),
                            'int' => TextInput::make('value')->integer(),
                            default => TextInput::make('value')->maxLength(2000),
                        },
                        Textarea::make('reason')->required()->maxLength(500)->rows(2),
                    ])
                    ->action(fn (array $data, SystemSetting $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $settings->update(auth()->user(), [$record->key => blank($data['value'] ?? null) && $record->type !== 'bool' ? null : $data['value']], $data['reason']),
                        'Setting saved',
                    )),
                Action::make('verify')
                    ->label('Mark verified')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Confirm you checked this value against an authoritative source. You cannot verify a value you changed yourself.')
                    ->visible(fn (SystemSetting $record) => $record->requires_verification && $record->verified_at === null && filled($record->getRawOriginal('value')) && auth()->user()->can('settings.manage'))
                    ->action(fn (SystemSetting $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $settings->markVerified(auth()->user(), $record->key),
                        'Setting verified',
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageSystemSettings::route('/')];
    }
}
