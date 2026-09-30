<?php

namespace App\Filament\Resources\ObjectionScripts;

use App\Domain\Audit\AuditLogger;
use App\Filament\Resources\ObjectionScripts\Pages\ManageObjectionScripts;
use App\Models\ObjectionScript;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class ObjectionScriptResource extends Resource
{
    protected static ?string $model = ObjectionScript::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleBottomCenterText;

    protected static string|UnitEnum|null $navigationGroup = 'Sales enablement';

    protected static ?string $navigationLabel = 'Objection scripts';

    /**
     * Script authors and compliance reviewers see drafts; everyone else sees approved scripts only.
     */
    public static function getEloquentQuery(): Builder
    {
        $user = auth()->user();
        $query = parent::getEloquentQuery();

        return $user->canAny(['sales_scripts.manage', 'templates.approve'])
            ? $query
            : $query->where('status', ObjectionScript::APPROVED);
    }

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all', 'sales_scripts.manage', 'templates.approve']);
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('sales_scripts.manage');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('sales_scripts.manage') && $record->status !== ObjectionScript::RETIRED;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('objection')->label('When the client says…')->required()->maxLength(255),
            TextInput::make('tag')->required()->maxLength(48)->datalist(['price', 'trust', 'timing', 'past-loss', 'family', 'competition']),
            Textarea::make('response')
                ->required()
                ->rows(6)
                ->maxLength(5000)
                ->helperText('Never promise returns, accuracy or safety of capital. Editing an approved script sends it back for compliance review.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('tag')
            ->columns([
                TextColumn::make('objection')->searchable()->weight('medium')->wrap()
                    ->description(fn (ObjectionScript $record) => str($record->response)->limit(160)),
                TextColumn::make('tag')->badge()->color('gray'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    ObjectionScript::APPROVED => 'success',
                    ObjectionScript::DRAFT => 'warning',
                    default => 'gray',
                })->visible(fn () => auth()->user()->canAny(['sales_scripts.manage', 'templates.approve'])),
                TextColumn::make('approver.name')->label('Approved by')->placeholder('—')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('tag')->options(fn () => ObjectionScript::query()->distinct()->pluck('tag', 'tag')),
            ])
            ->recordActions([
                Action::make('read')
                    ->label('Read')
                    ->icon(Heroicon::OutlinedEye)
                    ->modalHeading(fn (ObjectionScript $record) => $record->objection)
                    ->modalContent(fn (ObjectionScript $record) => str($record->response)->markdown(['html_input' => 'strip', 'allow_unsafe_links' => false])->toHtmlString())
                    ->modalSubmitAction(false),
                EditAction::make(),
                Action::make('approve')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Confirm the script contains no return, accuracy or capital-safety claims.')
                    ->visible(fn (ObjectionScript $record) => $record->status === ObjectionScript::DRAFT && auth()->user()->can('templates.approve'))
                    ->action(function (ObjectionScript $record, Action $action): void {
                        if ($record->created_by === auth()->id()) {
                            Notification::make()->danger()->title('A script must be approved by someone other than its author.')->send();
                            $action->halt();
                        }

                        $record->forceFill(['status' => ObjectionScript::APPROVED, 'approved_by' => auth()->id(), 'approved_at' => now()])->save();
                        app(AuditLogger::class)->record('objection_script.approved', $record);
                    }),
                Action::make('retire')
                    ->icon(Heroicon::OutlinedArchiveBox)
                    ->color('gray')
                    ->requiresConfirmation()
                    ->visible(fn (ObjectionScript $record) => $record->status !== ObjectionScript::RETIRED && auth()->user()->canAny(['sales_scripts.manage', 'templates.approve']))
                    ->action(function (ObjectionScript $record): void {
                        $record->forceFill(['status' => ObjectionScript::RETIRED])->save();
                        app(AuditLogger::class)->record('objection_script.retired', $record);
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageObjectionScripts::route('/')];
    }
}
