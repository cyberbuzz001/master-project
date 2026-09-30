<?php

namespace App\Filament\Resources\LeadImports;

use App\Domain\Crm\ImportRollbackService;
use App\Filament\Imports\LeadImporter;
use App\Filament\Resources\LeadImports\Pages\ManageLeadImports;
use App\Filament\Support\DomainAction;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\Imports\Models\Import;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class LeadImportResource extends Resource
{
    protected static ?string $model = Import::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedArrowUpTray;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Import history';

    protected static ?string $modelLabel = 'lead import';

    protected static ?string $slug = 'lead-imports';

    public static function getEloquentQuery(): Builder
    {
        $query = parent::getEloquentQuery()->where('importer', LeadImporter::class)->with('user:id,name');

        return auth()->user()->can('leads.view_all') ? $query : $query->where('user_id', auth()->id());
    }

    public static function canViewAny(): bool
    {
        return auth()->user()->can('leads.import');
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('file_name')->weight('medium')->searchable()->description(fn (Import $record) => 'by '.$record->user?->name),
                TextColumn::make('created_at')->label('Started')->dateTime('d M Y, h:i A', $tz),
                TextColumn::make('total_rows')->label('Rows')->numeric(),
                TextColumn::make('successful_rows')->label('Imported')->numeric()->color('success'),
                TextColumn::make('failed')->label('Failed')->state(fn (Import $record) => $record->getFailedRowsCount())->color(fn (int $state) => $state > 0 ? 'danger' : null),
                TextColumn::make('status')->badge()->state(fn (Import $record) => match (true) {
                    $record->rolled_back_at !== null => 'Rolled back ('.$record->rolled_back_rows.')',
                    $record->completed_at !== null => 'Completed',
                    default => 'Processing',
                })->color(fn (string $state) => str_starts_with($state, 'Rolled') ? 'gray' : ($state === 'Completed' ? 'success' : 'warning')),
            ])
            ->recordActions([
                Action::make('rollback')
                    ->label('Roll back')
                    ->icon(Heroicon::OutlinedArrowUturnLeft)
                    ->color('danger')
                    ->visible(fn (Import $record) => auth()->user()->can('rollback', $record))
                    ->modalDescription(function (Import $record): string {
                        $preview = app(ImportRollbackService::class)->preview($record);

                        return "{$preview['removed']} untouched leads will be removed. {$preview['kept']} leads that were already worked will be kept.";
                    })
                    ->schema([Textarea::make('reason')->required()->minLength(5)->maxLength(500)->rows(2)])
                    ->action(fn (array $data, Import $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => app(ImportRollbackService::class)->rollback(auth()->user(), $record, $data['reason']),
                        'Import rolled back',
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageLeadImports::route('/')];
    }
}
