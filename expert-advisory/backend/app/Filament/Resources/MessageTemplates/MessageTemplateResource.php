<?php

namespace App\Filament\Resources\MessageTemplates;

use App\Domain\Communications\TemplateApprovalService;
use App\Filament\Resources\MessageTemplates\Pages\ManageMessageTemplates;
use App\Filament\Support\DomainAction;
use App\Models\MessageTemplate;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class MessageTemplateResource extends Resource
{
    protected static ?string $model = MessageTemplate::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    protected static string|UnitEnum|null $navigationGroup = 'Communications';

    protected static ?string $navigationLabel = 'Message templates';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['templates.manage', 'templates.approve']);
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

    public static function draftSchema(): array
    {
        return [
            TextInput::make('key')->required()->maxLength(100), TextInput::make('name')->required()->maxLength(255),
            Select::make('channel')->options(['whatsapp' => 'WhatsApp', 'email' => 'Email'])->required()->default('whatsapp'),
            TextInput::make('subject')->maxLength(255), Textarea::make('body')->required()->maxLength(4096)->rows(5),
            TagsInput::make('variables')->helperText('Variable names in the same order as the approved Meta body, for example: name, service, expiry.'),
            Select::make('purpose')->options(['whatsapp' => 'General WhatsApp', 'research_communication' => 'Research updates', 'educational_content' => 'Education', 'transactional_email' => 'Service email', 'marketing_email' => 'Marketing email']),
            TextInput::make('provider_template_name')->label('Meta template name')->maxLength(100),
            TextInput::make('language_code')->required()->default('en')->maxLength(16),
            TextInput::make('provider_media_id')->label('Approved Meta document/image media ID')->maxLength(255)->helperText('For document/image header templates, use the ID of the approved material uploaded to this WhatsApp Business account.'),
        ];
    }

    public static function createDraftAction(): Action
    {
        return Action::make('createDraft')->label('Draft template')->visible(fn (): bool => auth()->user()->can('templates.manage'))
            ->schema(self::draftSchema())->action(fn (array $data, Action $action) => DomainAction::run($action, fn () => app(TemplateApprovalService::class)->saveDraft(auth()->user(), $data), 'Draft saved'));
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->searchable(), TextColumn::make('key')->searchable(), TextColumn::make('channel')->badge(),
            TextColumn::make('status')->badge(), TextColumn::make('provider_status')->label('Meta status')->badge(), TextColumn::make('provider_checked_at')->since()->label('Meta checked'),
        ])->recordActions([
            Action::make('editDraft')->visible(fn (MessageTemplate $record): bool => auth()->user()->can('templates.manage') && $record->status === 'draft')
                ->fillForm(fn (MessageTemplate $record): array => $record->toArray())->schema(self::draftSchema())
                ->action(fn (array $data, MessageTemplate $record, Action $action) => DomainAction::run($action, fn () => app(TemplateApprovalService::class)->saveDraft(auth()->user(), $data, $record), 'Draft saved')),
            Action::make('approve')->visible(fn (MessageTemplate $record): bool => auth()->user()->can('templates.approve') && $record->author_id !== auth()->id() && $record->status === 'draft')->requiresConfirmation()
                ->action(fn (MessageTemplate $record, Action $action) => DomainAction::run($action, fn () => app(TemplateApprovalService::class)->approve(auth()->user(), $record), 'Template approved')),
            Action::make('syncMeta')->label('Verify with Meta')->visible(fn (MessageTemplate $record): bool => self::canViewAny() && $record->channel === 'whatsapp')
                ->action(function (MessageTemplate $record): void {
                    abort_unless(self::canViewAny(), 403);
                    app(TemplateApprovalService::class)->syncMeta($record);
                }),
        ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageMessageTemplates::route('/')];
    }
}
