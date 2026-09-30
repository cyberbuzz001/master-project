<?php

namespace App\Filament\Resources\Agreements\RelationManagers;

use App\Domain\Onboarding\AgreementService;
use App\Filament\Support\DomainAction;
use App\Models\AgreementVersion;
use Filament\Actions\Action;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class VersionsRelationManager extends RelationManager
{
    protected static string $relationship = 'versions';

    protected static ?string $title = 'Versions';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedRectangleStack;

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $service = app(AgreementService::class);

        return $table
            ->columns([
                TextColumn::make('version')->label('v')->sortable(),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    AgreementVersion::PUBLISHED => 'success',
                    AgreementVersion::IN_REVIEW => 'warning',
                    AgreementVersion::RETIRED => 'gray',
                    default => 'info',
                }),
                TextColumn::make('author.name')->label('Drafted by')->placeholder('—'),
                TextColumn::make('approver.name')->label('Approved by')->placeholder('Not approved'),
                TextColumn::make('effective_from')->date('d M Y', $tz)->placeholder('—'),
                TextColumn::make('acceptances_count')->label('Acceptances')->counts('acceptances'),
            ])
            ->headerActions([
                Action::make('draft')
                    ->label('Draft new version')
                    ->icon(Heroicon::OutlinedPencilSquare)
                    ->visible(fn () => auth()->user()->can('policies.edit'))
                    ->modalWidth('4xl')
                    ->schema([
                        MarkdownEditor::make('body_markdown')->label('Agreement text')->required()->columnSpanFull(),
                        DatePicker::make('effective_from')->label('Effective from'),
                    ])
                    ->action(fn (array $data, Action $action) => DomainAction::run($action, fn () => $service->draft(
                        auth()->user(),
                        $this->getOwnerRecord(),
                        $data['body_markdown'],
                        $data['effective_from'] ?? null,
                    ), 'Draft created')),
            ])
            ->recordActions([
                Action::make('read')
                    ->label('Read')
                    ->icon(Heroicon::OutlinedDocumentText)
                    ->color('gray')
                    ->modalWidth('3xl')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (AgreementVersion $record) => view('filament.clients.agreement-text', ['version' => $record])),
                Action::make('edit')
                    ->label('Edit draft')
                    ->icon(Heroicon::OutlinedPencil)
                    ->visible(fn (AgreementVersion $record) => $record->status === AgreementVersion::DRAFT && auth()->user()->can('policies.edit'))
                    ->modalWidth('4xl')
                    ->fillForm(fn (AgreementVersion $record) => $record->only(['body_markdown', 'effective_from']))
                    ->schema([
                        MarkdownEditor::make('body_markdown')->label('Agreement text')->required()->columnSpanFull(),
                        DatePicker::make('effective_from')->label('Effective from'),
                    ])
                    ->action(fn (array $data, AgreementVersion $record, Action $action) => DomainAction::run(
                        $action,
                        fn () => $record->update($data),
                        'Draft updated',
                    )),
                Action::make('submit')
                    ->label('Submit for approval')
                    ->icon(Heroicon::OutlinedPaperAirplane)
                    ->color('warning')
                    ->requiresConfirmation()
                    ->visible(fn (AgreementVersion $record) => $record->status === AgreementVersion::DRAFT && auth()->user()->can('policies.edit'))
                    ->action(fn (AgreementVersion $record, Action $action) => DomainAction::run($action, fn () => $service->submitForApproval(auth()->user(), $record), 'Submitted for approval')),
                Action::make('approve')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('You are confirming the wording is accurate and complete. The author cannot approve their own text.')
                    ->visible(fn (AgreementVersion $record) => $record->status === AgreementVersion::IN_REVIEW && auth()->user()->can('policies.approve'))
                    ->action(fn (AgreementVersion $record, Action $action) => DomainAction::run($action, fn () => $service->approve(auth()->user(), $record), 'Approved')),
                Action::make('publish')
                    ->icon(Heroicon::OutlinedGlobeAlt)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Clients will be asked to accept this version from now on.')
                    ->visible(fn (AgreementVersion $record) => $record->approved_at !== null && $record->status !== AgreementVersion::PUBLISHED && auth()->user()->can('policies.publish'))
                    ->action(fn (AgreementVersion $record, Action $action) => DomainAction::run($action, fn () => $service->publish(auth()->user(), $record), 'Published')),
            ]);
    }
}
