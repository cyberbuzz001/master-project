<?php

namespace App\Filament\Resources\Clients\RelationManagers;

use App\Models\AgreementAcceptance;
use Filament\Actions\Action;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class AcceptancesRelationManager extends RelationManager
{
    protected static string $relationship = 'agreementAcceptances';

    protected static ?string $title = 'Agreements';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedDocumentCheck;

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->description('Acceptances are append-only evidence of which exact text the client agreed to.')
            ->columns([
                TextColumn::make('agreementVersion.agreement.title')->label('Agreement'),
                TextColumn::make('agreementVersion.version')->label('Version'),
                TextColumn::make('method')->badge()->color('gray')
                    ->formatStateUsing(fn (string $state) => str($state)->replace('_', ' ')->headline()),
                TextColumn::make('accepted_at')->label('Accepted')->dateTime('d M Y, h:i A', $tz),
                TextColumn::make('evidence_sha256')->label('Evidence')->formatStateUsing(fn (string $state) => Str::limit($state, 12))->copyable()->toggleable(),
            ])
            ->recordActions([
                Action::make('text')
                    ->label('View accepted text')
                    ->icon(Heroicon::OutlinedDocumentText)
                    ->color('gray')
                    ->modalWidth('3xl')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (AgreementAcceptance $record) => view('filament.clients.agreement-text', [
                        'version' => $record->agreementVersion,
                    ])),
            ]);
    }
}
