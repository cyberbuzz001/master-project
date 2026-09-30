<?php

namespace App\Filament\Resources\PolicyDocuments\RelationManagers;

use App\Domain\Compliance\PolicyDocumentService;
use App\Filament\Support\DomainAction;
use App\Models\PolicyDocument;
use App\Models\PolicyDocumentVersion;
use Filament\Actions\Action;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class VersionsRelationManager extends RelationManager
{
    protected static string $relationship = 'versions';

    protected static ?string $title = 'Versions';

    public function isReadOnly(): bool
    {
        return false;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $service = app(PolicyDocumentService::class);

        return $table
            ->defaultSort('version', 'desc')
            ->columns([
                TextColumn::make('version')->label('v'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    PolicyDocumentVersion::PUBLISHED => 'success',
                    PolicyDocumentVersion::APPROVED => 'info',
                    PolicyDocumentVersion::DRAFT => 'warning',
                    default => 'gray',
                }),
                TextColumn::make('change_summary')->label('Summary')->limit(60)->placeholder('—')->wrap(),
                TextColumn::make('effective_from')->date('d M Y')->placeholder('—'),
                TextColumn::make('review_due_at')->label('Review due')->date('d M Y')->placeholder('—')
                    ->color(fn (PolicyDocumentVersion $record) => $record->review_due_at?->isPast() && $record->status === PolicyDocumentVersion::PUBLISHED ? 'danger' : null),
                TextColumn::make('published_at')->dateTime('d M Y, h:i A', $tz)->placeholder('—'),
                TextColumn::make('content_hash')->label('SHA-256')->limit(12)->fontFamily('mono')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                Action::make('newVersion')
                    ->label('New version')
                    ->icon(Heroicon::OutlinedPlus)
                    ->modalWidth('5xl')
                    ->visible(fn () => auth()->user()->can('policies.edit'))
                    ->fillForm(fn () => ['body_markdown' => $this->getOwnerRecord()->versions()->first()?->body_markdown])
                    ->schema([
                        MarkdownEditor::make('body_markdown')->label('Text')->required()->minLength(20)->maxLength(200000),
                        TextInput::make('change_summary')->maxLength(1000),
                        DatePicker::make('effective_from'),
                        DatePicker::make('review_due_at')->minDate(now()->addDay()),
                        TextInput::make('source_url')->url()->maxLength(2048)->helperText('For regulations and circulars: the official source.'),
                    ])
                    ->action(function (array $data, Action $action) use ($service): void {
                        /** @var PolicyDocument $document */
                        $document = $this->getOwnerRecord();
                        DomainAction::run($action, fn () => $service->createDraft(auth()->user(), $document, $data), 'Draft version created');
                    }),
            ])
            ->recordActions([
                Action::make('read')
                    ->icon(Heroicon::OutlinedEye)
                    ->modalSubmitAction(false)
                    ->modalWidth('4xl')
                    ->modalHeading(fn (PolicyDocumentVersion $record) => 'Version '.$record->version)
                    ->modalContent(fn (PolicyDocumentVersion $record) => Str::of($record->body_markdown)->markdown(['html_input' => 'strip', 'allow_unsafe_links' => false])->toHtmlString()),
                Action::make('approve')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('info')
                    ->requiresConfirmation()
                    ->modalDescription('Approve only text reviewed by counsel. You cannot approve a version you wrote.')
                    ->visible(fn (PolicyDocumentVersion $record) => $record->status === PolicyDocumentVersion::DRAFT && auth()->user()->can('policies.approve'))
                    ->action(fn (PolicyDocumentVersion $record, Action $action) => DomainAction::run($action, fn () => $service->approve(auth()->user(), $record), 'Version approved')),
                Action::make('publish')
                    ->icon(Heroicon::OutlinedGlobeAlt)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('This version becomes the live public text; the previous version is archived.')
                    ->visible(fn (PolicyDocumentVersion $record) => $record->status === PolicyDocumentVersion::APPROVED && auth()->user()->can('policies.publish'))
                    ->action(fn (PolicyDocumentVersion $record, Action $action) => DomainAction::run($action, fn () => $service->publish(auth()->user(), $record), 'Version published')),
            ]);
    }
}
