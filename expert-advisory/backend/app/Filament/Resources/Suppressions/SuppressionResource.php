<?php

namespace App\Filament\Resources\Suppressions;

use App\Filament\Resources\Suppressions\Pages\ManageSuppressions;
use App\Models\SuppressionRecord;
use BackedEnum;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class SuppressionResource extends Resource
{
    protected static ?string $model = SuppressionRecord::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedNoSymbol;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'DND & Suppressions';

    protected static ?string $modelLabel = 'Suppression Record';

    protected static ?string $slug = 'compliance/suppressions';

    public static function canViewAny(): bool
    {
        return auth()->user()->canAny(['compliance.view', 'leads.view_all']);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([
            TextInput::make('phone_e164')
                ->label('Phone (E.164 format)')
                ->placeholder('+919876543210')
                ->maxLength(32),
            TextInput::make('email')
                ->label('Email Address')
                ->email()
                ->maxLength(255),
            Select::make('reason')
                ->label('Suppression Reason')
                ->options([
                    'USER_OPT_OUT' => 'User Opt-Out (STOP / Unsubscribe)',
                    'STOP_KEYWORD' => 'WhatsApp STOP Keyword Detected',
                    'DND_REGISTRY' => 'TRAI National DND Registry',
                    'COMPLAINT' => 'Regulatory Grievance / Complaint',
                    'MANUAL_ADMIN' => 'Manual Administrative Suppression',
                ])
                ->default('USER_OPT_OUT')
                ->required(),
            Select::make('channel')
                ->label('Suppressed Channel')
                ->options([
                    'all' => 'All Channels (WhatsApp, Calls, SMS, Email)',
                    'whatsapp' => 'WhatsApp Only',
                    'calls' => 'Voice Calls Only',
                ])
                ->default('all')
                ->required(),
            Textarea::make('evidence_text')
                ->label('Evidence / Request Context')
                ->placeholder('e.g. Inbound WhatsApp message received: "STOP"')
                ->rows(3),
        ]);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('phone_e164')->label('Phone')->searchable()->copyable()->weight('bold'),
                TextColumn::make('email')->label('Email')->searchable()->copyable()->placeholder('—'),
                TextColumn::make('reason')->label('Reason')->badge()->color('danger'),
                TextColumn::make('channel')->label('Channel')->badge()->color('warning'),
                TextColumn::make('evidence_text')->label('Evidence')->limit(40)->tooltip(fn (SuppressionRecord $r) => $r->evidence_text),
                TextColumn::make('created_at')->label('Suppressed At')->dateTime('d M Y, h:i A', $tz)->sortable(),
            ])
            ->filters([
                SelectFilter::make('reason')->options([
                    'USER_OPT_OUT' => 'User Opt-Out',
                    'STOP_KEYWORD' => 'STOP Keyword',
                    'DND_REGISTRY' => 'DND Registry',
                    'COMPLAINT' => 'Complaint',
                    'MANUAL_ADMIN' => 'Manual Admin',
                ]),
                SelectFilter::make('channel')->options([
                    'all' => 'All Channels',
                    'whatsapp' => 'WhatsApp Only',
                    'calls' => 'Calls Only',
                ]),
            ])
            ->recordActions([
                DeleteAction::make(),
            ])
            ->headerActions([
                CreateAction::make()->label('Add to DND / Suppression'),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageSuppressions::route('/')];
    }
}
