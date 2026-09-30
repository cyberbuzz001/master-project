<?php

namespace App\Filament\Resources\TrainingModules;

use App\Domain\Audit\AuditLogger;
use App\Domain\Workforce\TrainingService;
use App\Filament\Resources\TrainingModules\Pages\ManageTrainingModules;
use App\Filament\Support\DomainAction;
use App\Models\TrainingModule;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Checkbox;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use UnitEnum;

class TrainingModuleResource extends Resource
{
    protected static ?string $model = TrainingModule::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedAcademicCap;

    protected static string|UnitEnum|null $navigationGroup = 'Workforce';

    protected static ?int $navigationSort = 1;

    protected static ?string $navigationLabel = 'Training';

    public static function canViewAny(): bool
    {
        return auth()->user()->isStaff();
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('training.manage');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('training.manage') && $record->status !== TrainingModule::RETIRED;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    /**
     * Managers see every module; other staff see published modules that apply to them.
     */
    public static function getEloquentQuery(): Builder
    {
        $user = auth()->user();
        $query = parent::getEloquentQuery();

        if ($user->can('training.manage')) {
            return $query;
        }

        $ids = TrainingModule::query()->where('status', TrainingModule::PUBLISHED)->get()->filter(fn (TrainingModule $m) => $m->appliesTo($user))->pluck('id');

        return $query->whereKey($ids);
    }

    public static function getNavigationBadge(): ?string
    {
        $pending = app(TrainingService::class)->pendingMandatoryFor(auth()->user())->count();

        return $pending > 0 ? (string) $pending : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('title')->required()->maxLength(255)->columnSpanFull(),
            Textarea::make('summary')->rows(2)->maxLength(1000)->columnSpanFull(),
            MarkdownEditor::make('body_markdown')->label('Content')->columnSpanFull(),
            TextInput::make('content_url')->label('External material (video or document link)')->url()->maxLength(2048)->columnSpanFull(),
            Toggle::make('is_mandatory')->label('Mandatory before using the back-office')->default(true),
            TextInput::make('due_within_days')->label('Due within (days)')->integer()->minValue(1)->maxValue(365),
            CheckboxList::make('role_names')
                ->label('Applies to roles (leave empty for all staff)')
                ->options(fn () => Role::query()->where('is_staff', true)->orderBy('id')->pluck('label', 'name'))
                ->columns(3)
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        $training = app(TrainingService::class);

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('title')->searchable()->weight('medium')->description(fn (TrainingModule $record) => $record->summary),
                TextColumn::make('version')->label('v'),
                IconColumn::make('is_mandatory')->label('Mandatory')->boolean(),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    TrainingModule::PUBLISHED => 'success',
                    TrainingModule::DRAFT => 'warning',
                    default => 'gray',
                })->visible(fn () => auth()->user()->can('training.manage')),
                TextColumn::make('my_status')->label('Your status')->badge()
                    ->state(fn (TrainingModule $record) => $record->status !== TrainingModule::PUBLISHED || ! $record->appliesTo(auth()->user())
                        ? 'Not assigned'
                        : ($training->hasAcknowledged(auth()->user(), $record) ? 'Completed' : 'To do'))
                    ->color(fn (string $state) => match ($state) {
                        'Completed' => 'success',
                        'To do' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('completion')->label('Completed by')
                    ->state(fn (TrainingModule $record) => $record->acknowledgements()->where('module_version', $record->version)->count())
                    ->visible(fn () => auth()->user()->can('training.manage')),
            ])
            ->recordActions([
                Action::make('complete')
                    ->label(fn (TrainingModule $record) => $training->hasAcknowledged(auth()->user(), $record) ? 'Review' : 'Open & complete')
                    ->icon(Heroicon::OutlinedBookOpen)
                    ->color('primary')
                    ->visible(fn (TrainingModule $record) => $record->status === TrainingModule::PUBLISHED && $record->appliesTo(auth()->user()))
                    ->modalWidth('4xl')
                    ->modalHeading(fn (TrainingModule $record) => $record->title)
                    ->modalContent(fn (TrainingModule $record) => new HtmlString(
                        ($record->body_markdown ? Str::markdown($record->body_markdown, ['html_input' => 'strip', 'allow_unsafe_links' => false]) : '')
                        .($record->content_url ? '<p class="esc-callout"><a href="'.e($record->content_url).'" target="_blank" rel="noopener noreferrer">Open the training material ↗</a></p>' : '')
                    ))
                    ->schema(fn (TrainingModule $record) => $training->hasAcknowledged(auth()->user(), $record) ? [] : [
                        Checkbox::make('confirm')->label('I have read and understood this training')->accepted(),
                    ])
                    ->modalSubmitAction(fn (TrainingModule $record, $action) => $training->hasAcknowledged(auth()->user(), $record) ? false : $action)
                    ->modalSubmitActionLabel('Mark as completed')
                    ->action(fn (TrainingModule $record, Action $action) => DomainAction::run($action, fn () => $training->acknowledge(auth()->user(), $record), 'Training completed')),
                ActionGroup::make([
                    EditAction::make()->after(fn (TrainingModule $record) => app(AuditLogger::class)->record('training.updated', $record, new: $record->getChanges())),
                    Action::make('publish')
                        ->icon(Heroicon::OutlinedGlobeAlt)
                        ->color('success')
                        ->requiresConfirmation()
                        ->modalDescription('Mandatory modules block the back-office for assigned staff until they complete them.')
                        ->visible(fn (TrainingModule $record) => $record->status === TrainingModule::DRAFT && auth()->user()->can('training.manage'))
                        ->action(fn (TrainingModule $record, Action $action) => DomainAction::run($action, fn () => $training->publish(auth()->user(), $record), 'Training published')),
                    Action::make('retire')
                        ->icon(Heroicon::OutlinedArchiveBox)
                        ->color('gray')
                        ->requiresConfirmation()
                        ->visible(fn (TrainingModule $record) => $record->status === TrainingModule::PUBLISHED && auth()->user()->can('training.manage'))
                        ->action(fn (TrainingModule $record, Action $action) => DomainAction::run($action, fn () => $training->retire(auth()->user(), $record), 'Training retired')),
                ])->visible(fn () => auth()->user()->can('training.manage')),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageTrainingModules::route('/')];
    }
}
