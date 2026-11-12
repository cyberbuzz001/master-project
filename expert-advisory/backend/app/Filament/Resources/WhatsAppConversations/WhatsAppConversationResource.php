<?php

namespace App\Filament\Resources\WhatsAppConversations;

use App\Domain\Communications\WhatsAppInboxService;
use App\Filament\Resources\WhatsAppConversations\Pages\ManageWhatsAppConversations;
use App\Models\AiConversation;
use App\Models\Lead;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use UnitEnum;

class WhatsAppConversationResource extends Resource
{
    protected static ?string $model = AiConversation::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    protected static string|UnitEnum|null $navigationGroup = 'Communications';

    protected static ?string $navigationLabel = 'WhatsApp inbox';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('messages.send_approved');
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
        return parent::getEloquentQuery()->where('channel', 'whatsapp')->with('lead')->whereIn('lead_id', Lead::query()->visibleTo(auth()->user())->select('id'));
    }

    public static function table(Table $table): Table
    {
        return $table->defaultSort('last_activity_at', 'desc')->columns([
            TextColumn::make('lead.full_name')->label('Contact')->searchable(), TextColumn::make('lead.mobile')->searchable(),
            IconColumn::make('is_paused_for_human')->label('Human takeover')->boolean(), TextColumn::make('total_messages'),
            TextColumn::make('last_activity_at')->dateTime('d M Y H:i', 'Asia/Kolkata'),
        ])->recordActions([
            Action::make('history')->label('Conversation')->schema([
                Textarea::make('history')->rows(16)->disabled()->dehydrated(false)->default(function (AiConversation $record): string {
                    Gate::authorize('view', $record->lead);

                    return $record->messages()->reorder('id', 'desc')->limit(100)->get()->reverse()->map(fn ($m) => $m->created_at->timezone('Asia/Kolkata')->format('d M H:i').' '.$m->sender_type.' ['.$m->delivery_status.']'."\n".$m->message_text)->implode("\n\n");
                }),
            ])->modalSubmitAction(false),
            Action::make('reply')->label('Reply & take over')->schema([
                Hidden::make('request_key')->default(fn (): string => (string) Str::uuid()),
                Textarea::make('text')->label('Reply')->required()->maxLength(4096)->helperText('Free-text replies require a verified inbound message within the last 24 hours. Sending pauses automated replies.'),
            ])->action(function (AiConversation $record, array $data): void {
                $message = app(WhatsAppInboxService::class)->reply(auth()->user(), $record, $data['text'], $data['request_key']);
                $notice = Notification::make()->title('Reply: '.$message->delivery_status);
                if (in_array($message->delivery_status, ['accepted', 'delivered', 'read'], true)) {
                    $notice->success();
                } else {
                    $notice->warning()->body($message->error_message);
                }
                $notice->send();
            }),
            Action::make('takeover')->label(fn (AiConversation $record): string => $record->is_paused_for_human ? 'Resume automation' : 'Take over')->schema([Textarea::make('reason')->required()->minLength(10)->maxLength(500)])
                ->action(fn (AiConversation $record, array $data) => app(WhatsAppInboxService::class)->takeover(auth()->user(), $record, ! $record->is_paused_for_human, $data['reason'])),
        ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageWhatsAppConversations::route('/')];
    }
}
