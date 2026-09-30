<?php

namespace App\Filament\Resources\Clients\RelationManagers;

use App\Domain\Onboarding\KycService;
use App\Filament\Support\DomainAction;
use App\Models\Document;
use App\Models\KycCheck;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Components\Component;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class KycChecksRelationManager extends RelationManager
{
    protected static string $relationship = 'kycChecks';

    protected static ?string $title = 'KYC';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedFingerPrint;

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()->can('viewKyc', $ownerRecord);
    }

    public function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $kyc = app(KycService::class);

        return $table
            ->description('Identity numbers are stored masked. Verification is done by a person against the uploaded document.')
            ->columns([
                TextColumn::make('type')->label('Check')->formatStateUsing(fn (string $state) => config("onboarding.kyc.types.{$state}.label", $state)),
                TextColumn::make('identifier_masked')->label('Number')->placeholder('—'),
                TextColumn::make('document.title')->label('Document')->placeholder('Not attached'),
                TextColumn::make('status')->badge()->color(fn (string $state) => match ($state) {
                    KycCheck::VERIFIED => 'success',
                    KycCheck::REJECTED => 'danger',
                    default => 'warning',
                }),
                TextColumn::make('remarks')->wrap()->placeholder('—')->toggleable(),
                TextColumn::make('verified_at')->label('Checked')->dateTime('d M Y, h:i A', $tz)->placeholder('—'),
            ])
            ->headerActions([
                Action::make('recordCheck')
                    ->label('Record check')
                    ->icon(Heroicon::OutlinedPlus)
                    ->visible(fn () => auth()->user()->can('uploadDocuments', $this->getOwnerRecord()) || auth()->user()->can('kyc.verify'))
                    ->schema($this->checkSchema())
                    ->action(fn (array $data, Action $action) => DomainAction::run($action, fn () => app(KycService::class)->record(
                        auth()->user(),
                        $this->getOwnerRecord(),
                        $data['type'],
                        $data['identifier'] ?? null,
                        isset($data['document_id']) ? Document::find($data['document_id']) : null,
                        $data['remarks'] ?? null,
                    ), 'Check recorded')),
            ])
            ->recordActions([
                Action::make('verify')
                    ->icon(Heroicon::OutlinedCheckBadge)
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Confirm the document matches the number and the name on the client record.')
                    ->visible(fn (KycCheck $record) => auth()->user()->can('kyc.verify') && $record->status !== KycCheck::VERIFIED)
                    ->action(fn (KycCheck $record, Action $action) => DomainAction::run($action, fn () => $kyc->verify(auth()->user(), $record), 'Check verified')),
                Action::make('reject')
                    ->icon(Heroicon::OutlinedXCircle)
                    ->color('danger')
                    ->visible(fn (KycCheck $record) => auth()->user()->can('kyc.verify') && $record->status !== KycCheck::REJECTED)
                    ->schema([Textarea::make('remarks')->label('What is wrong?')->required()->rows(2)->maxLength(1000)])
                    ->action(fn (array $data, KycCheck $record, Action $action) => DomainAction::run($action, fn () => $kyc->reject(auth()->user(), $record, $data['remarks']), 'Check rejected')),
                Action::make('duplicates')
                    ->label('Same number elsewhere')
                    ->icon(Heroicon::OutlinedUsers)
                    ->color('warning')
                    ->visible(fn (KycCheck $record) => auth()->user()->can('kyc.view') && $kyc->duplicatesFor($record) !== [])
                    ->modalSubmitAction(false)
                    ->modalContent(fn (KycCheck $record) => view('filament.clients.kyc-duplicates', [
                        'clients' => $kyc->duplicatesFor($record),
                    ])),
            ]);
    }

    /**
     * @return list<Component>
     */
    private function checkSchema(): array
    {
        return [
            Select::make('type')
                ->options(collect(config('onboarding.kyc.types'))->map(fn (array $type) => $type['label'])->all())
                ->required()
                ->native(false),
            TextInput::make('identifier')
                ->label('Number as printed')
                ->maxLength(64)
                ->helperText('Stored masked plus a one-way hash. Never written to the audit log.'),
            Select::make('document_id')
                ->label('Uploaded document')
                ->options(fn () => Document::query()
                    ->where(['owner_type' => 'client', 'owner_id' => $this->getOwnerRecord()->id])
                    ->pluck('title', 'id'))
                ->native(false),
            Textarea::make('remarks')->rows(2)->maxLength(1000),
        ];
    }
}
