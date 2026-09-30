<?php

namespace App\Filament\Resources\SupportTickets;

use App\Domain\Support\SupportTicketService;
use App\Filament\Resources\SupportTickets\Pages\ManageSupportTickets;
use App\Models\SupportTicket;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class SupportTicketResource extends Resource
{
    protected static ?string $model = SupportTicket::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    protected static string|UnitEnum|null $navigationGroup = 'Support';

    protected static ?int $navigationSort = 1;

    protected static ?string $navigationLabel = 'Support Tickets';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('tickets.view') ?? false;
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

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('ticket_number')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                TextColumn::make('client.full_name')
                    ->label('Client')
                    ->searchable(),
                TextColumn::make('subject')
                    ->searchable(),
                TextColumn::make('category')
                    ->badge(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'open' => 'danger',
                        'in_progress' => 'warning',
                        'waiting_on_client' => 'primary',
                        'closed' => 'gray',
                        default => 'secondary',
                    }),
                TextColumn::make('last_reply_at')
                    ->dateTime('d M Y, H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(SupportTicket::STATUSES),
                SelectFilter::make('category')
                    ->options(SupportTicket::CATEGORIES),
            ])
            ->actions([
                Action::make('reply')
                    ->label('Reply')
                    ->icon('heroicon-o-paper-airplane')
                    ->visible(fn (SupportTicket $record): bool => $record->status !== 'closed' && (auth()->user()?->can('tickets.manage') ?? false))
                    ->form([
                        Textarea::make('message')
                            ->label('Staff Reply Message')
                            ->required()
                            ->rows(4),
                    ])
                    ->action(function (SupportTicket $record, array $data, SupportTicketService $service): void {
                        $service->addMessage($record, $data['message'], auth()->user(), true);
                        Notification::make()->title('Reply sent to client')->success()->send();
                    }),

                Action::make('close')
                    ->label('Close Ticket')
                    ->icon('heroicon-o-x-circle')
                    ->color('gray')
                    ->requiresConfirmation()
                    ->visible(fn (SupportTicket $record): bool => $record->status !== 'closed' && (auth()->user()?->can('tickets.manage') ?? false))
                    ->action(function (SupportTicket $record, SupportTicketService $service): void {
                        $service->closeTicket($record);
                        Notification::make()->title('Ticket closed')->success()->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageSupportTickets::route('/'),
        ];
    }
}
