<?php

namespace App\Filament\Resources\PolicyDocuments;

use App\Filament\Resources\PolicyDocuments\Pages\ListPolicyDocuments;
use App\Filament\Resources\PolicyDocuments\Pages\ViewPolicyDocument;
use App\Filament\Resources\PolicyDocuments\RelationManagers\VersionsRelationManager;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use BackedEnum;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class PolicyDocumentResource extends Resource
{
    protected static ?string $model = PolicyDocument::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentText;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 2;

    protected static ?string $navigationLabel = 'Policies & disclosures';

    protected static ?string $recordTitleAttribute = 'title';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('policies.view_drafts');
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
        return parent::getEloquentQuery()
            ->withCount(['versions as drafts_count' => fn (Builder $q) => $q->whereIn('status', [PolicyDocumentVersion::DRAFT, PolicyDocumentVersion::APPROVED])])
            ->withMax(['versions as published_version' => fn (Builder $q) => $q->where('status', PolicyDocumentVersion::PUBLISHED)], 'version');
    }

    public static function getNavigationBadge(): ?string
    {
        $approved = PolicyDocumentVersion::query()->where('status', PolicyDocumentVersion::APPROVED)->count();

        return $approved > 0 ? (string) $approved : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Approved versions waiting to be published';
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->columns(4)->components([
            TextEntry::make('title'),
            TextEntry::make('slug')->label('Public URL')->formatStateUsing(fn (string $state) => config('platform.frontend_url').'/legal/'.$state)->copyable(),
            TextEntry::make('category')->badge()->color('gray'),
            TextEntry::make('published_version')->label('Live version')->placeholder('Not published'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('title')
            ->columns([
                TextColumn::make('title')->searchable()->weight('medium')->description(fn (PolicyDocument $record) => '/legal/'.$record->slug),
                TextColumn::make('category')->badge()->color('gray'),
                TextColumn::make('published_version')->label('Live version')->badge()->color('success')->placeholder('Not published')
                    ->formatStateUsing(fn ($state) => 'v'.$state),
                TextColumn::make('drafts_count')->label('Awaiting approval / publication')->numeric(),
            ])
            ->recordActions([ViewAction::make()->label('Manage versions')]);
    }

    public static function getRelations(): array
    {
        return [VersionsRelationManager::class];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPolicyDocuments::route('/'),
            'view' => ViewPolicyDocument::route('/{record}'),
        ];
    }
}
