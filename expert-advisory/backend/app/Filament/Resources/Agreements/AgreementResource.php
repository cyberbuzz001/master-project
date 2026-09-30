<?php

namespace App\Filament\Resources\Agreements;

use App\Filament\Resources\Agreements\Pages\ManageAgreements;
use App\Filament\Resources\Agreements\RelationManagers\VersionsRelationManager;
use App\Models\Agreement;
use App\Models\AgreementVersion;
use BackedEnum;
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

class AgreementResource extends Resource
{
    protected static ?string $model = Agreement::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentCheck;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 3;

    protected static ?string $recordTitleAttribute = 'title';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['policies.view_drafts', 'policies.edit', 'agreements.record', 'clients.view_all']);
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('policies.edit');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('policies.edit');
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('code')->required()->maxLength(64),
            TextInput::make('title')->required()->maxLength(255),
            Textarea::make('description')->rows(2)->maxLength(1000)->columnSpanFull(),
            Toggle::make('requires_client_acceptance')->default(true)
                ->helperText('Clients must accept this before onboarding is complete.'),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->searchable()->description(fn (Agreement $record) => $record->code),
                TextColumn::make('published')->label('Published version')
                    ->state(fn (Agreement $record) => $record->publishedVersion()?->version ?? 'None')
                    ->badge()
                    ->color(fn (string $state) => $state === 'None' ? 'warning' : 'success'),
                TextColumn::make('acceptances')->label('Accepted by')
                    ->state(fn (Agreement $record) => AgreementVersion::query()
                        ->where('agreement_id', $record->id)
                        ->withCount('acceptances')
                        ->get()
                        ->sum('acceptances_count')),
                IconColumn::make('requires_client_acceptance')->label('Required')->boolean(),
                IconColumn::make('is_active')->label('Active')->boolean(),
            ]);
    }

    public static function getRelations(): array
    {
        return [VersionsRelationManager::class];
    }

    public static function getPages(): array
    {
        return ['index' => ManageAgreements::route('/')];
    }
}
