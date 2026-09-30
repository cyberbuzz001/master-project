<?php

namespace App\Filament\Resources\Clients;

use App\Filament\Resources\Clients\Pages\ListClients;
use App\Filament\Resources\Clients\Pages\ViewClient;
use App\Filament\Resources\Clients\RelationManagers\AcceptancesRelationManager;
use App\Filament\Resources\Clients\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\Clients\RelationManagers\KycChecksRelationManager;
use App\Filament\Resources\Clients\RelationManagers\RiskProfilesRelationManager;
use App\Filament\Resources\Clients\Schemas\ClientInfolist;
use App\Filament\Resources\Clients\Tables\ClientsTable;
use App\Models\Client;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class ClientResource extends Resource
{
    protected static ?string $model = Client::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedIdentification;

    protected static string|UnitEnum|null $navigationGroup = 'Clients';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'full_name';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->visibleTo(auth()->user())
            ->with(['relationshipManager.user:id,name', 'riskProfile']);
    }

    public static function infolist(Schema $schema): Schema
    {
        return ClientInfolist::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ClientsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            KycChecksRelationManager::class,
            DocumentsRelationManager::class,
            RiskProfilesRelationManager::class,
            AcceptancesRelationManager::class,
        ];
    }

    public static function getGloballySearchableAttributes(): array
    {
        return ['full_name', 'client_code', 'mobile', 'email'];
    }

    public static function getGlobalSearchResultDetails(Model $record): array
    {
        return array_filter([
            'Code' => $record->client_code,
            'Status' => $record->onboarding_status,
            'Manager' => $record->relationshipManager?->user?->name,
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListClients::route('/'),
            'view' => ViewClient::route('/{record}'),
        ];
    }
}
