<?php

namespace App\Filament\Resources\Services;

use App\Filament\Resources\Services\Pages\ManageServices;
use App\Filament\Resources\Services\RelationManagers\PlansRelationManager;
use App\Models\Plan;
use App\Models\Service;
use BackedEnum;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class ServiceResource extends Resource
{
    protected static ?string $model = Service::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSquares2x2;

    protected static string|UnitEnum|null $navigationGroup = 'Billing';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['services.manage', 'invoices.view', 'subscriptions.view']);
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('services.manage');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('services.manage');
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('code')->required()->maxLength(64),
            TextInput::make('name')->required()->maxLength(255),
            Select::make('category')->options(Service::CATEGORIES)->required()->native(false),
            TextInput::make('sort_order')->integer()->default(0),
            Textarea::make('summary')->rows(2)->maxLength(1000)->columnSpanFull()
                ->helperText('Shown to staff when selling. Describe what the client receives — never a return.'),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                TextColumn::make('name')->searchable()->description(fn (Service $record) => $record->code),
                TextColumn::make('category')->badge()->formatStateUsing(fn (string $state) => Service::CATEGORIES[$state] ?? $state),
                TextColumn::make('plans_count')->label('Plans')->counts('plans'),
                TextColumn::make('prices')->label('Published prices')
                    ->state(fn (Service $record) => $record->plans
                        ->map(fn (Plan $plan) => $plan->publishedVersion()?->price()->format())
                        ->filter()
                        ->join(', ') ?: 'None published'),
                IconColumn::make('is_active')->label('Active')->boolean(),
            ]);
    }

    public static function getRelations(): array
    {
        return [PlansRelationManager::class];
    }

    public static function getPages(): array
    {
        return ['index' => ManageServices::route('/')];
    }
}
