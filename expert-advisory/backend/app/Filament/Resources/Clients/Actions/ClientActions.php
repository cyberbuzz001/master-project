<?php

namespace App\Filament\Resources\Clients\Actions;

use App\Domain\Billing\InvoiceService;
use App\Domain\Billing\SubscriptionService;
use App\Domain\Onboarding\AgreementService;
use App\Domain\Onboarding\DocumentVault;
use App\Domain\Onboarding\OnboardingService;
use App\Domain\Onboarding\RiskProfileService;
use App\Filament\Support\DomainAction;
use App\Models\Agreement;
use App\Models\AgreementVersion;
use App\Models\Client;
use App\Models\Document;
use App\Models\PlanVersion;
use App\Models\RiskQuestion;
use App\Models\RiskQuestionnaireVersion;
use Filament\Actions\Action;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\Section;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;

/**
 * Onboarding actions. Every state change goes through a domain service; the UI never writes
 * lifecycle fields, scores or verification flags itself.
 */
final class ClientActions
{
    public static function takeAssessment(): Action
    {
        return Action::make('takeAssessment')
            ->label('Risk assessment')
            ->icon(Heroicon::OutlinedClipboardDocumentCheck)
            ->color('primary')
            ->modalWidth('3xl')
            ->modalHeading(fn (Client $record) => 'Risk assessment — '.$record->full_name)
            ->modalDescription('Answers are scored by a fixed rule set. The category is calculated, never estimated.')
            ->visible(fn (Client $record) => auth()->user()->can('assess', $record) && self::publishedQuestionnaire() !== null)
            ->schema(fn () => self::questionnaireSchema())
            ->action(function (array $data, Client $record, Action $action) {
                $version = self::publishedQuestionnaire();

                return DomainAction::run($action, function () use ($data, $record, $version) {
                    $profile = app(RiskProfileService::class)->submit($record, $version, $data['answers'] ?? [], auth()->user());

                    return $profile;
                }, 'Assessment recorded — ask the client to acknowledge the outcome');
            });
    }

    /**
     * Sells a plan: raises and issues the invoice, and queues the service for activation. Nothing
     * starts until a verified payment settles that invoice.
     */
    public static function sellService(): Action
    {
        return Action::make('sellService')
            ->label('Sell a service')
            ->icon(Heroicon::OutlinedShoppingBag)
            ->color('primary')
            ->modalDescription('This raises an invoice at the published price. The service starts only once a verified payment settles it.')
            ->visible(fn (Client $record) => auth()->user()->can('invoices.create')
                && auth()->user()->can('view', $record)
                && PlanVersion::query()->where('status', PlanVersion::PUBLISHED)->exists())
            ->schema([
                Select::make('plan_version_id')
                    ->label('Plan')
                    ->options(fn () => PlanVersion::query()
                        ->where('status', PlanVersion::PUBLISHED)
                        ->with('plan.service')
                        ->get()
                        ->filter(fn (PlanVersion $version) => $version->plan?->is_active && $version->plan->service?->is_active)
                        ->mapWithKeys(fn (PlanVersion $version) => [$version->id => $version->plan->service->name.' · '.$version->label()]))
                    ->required()
                    ->native(false),
                DatePicker::make('starts_on')->label('Service starts on')->helperText('Leave blank to start on the day the payment is verified.'),
                Textarea::make('notes')->label('Note on the invoice')->rows(2)->maxLength(2000),
            ])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run($action, fn () => app(SubscriptionService::class)->sell(
                auth()->user(),
                $record,
                PlanVersion::query()->findOrFail($data['plan_version_id']),
                app(InvoiceService::class),
                ['starts_on' => $data['starts_on'] ?? null, 'notes' => $data['notes'] ?? null],
            ), 'Invoice raised — the service starts once payment is verified'));
    }

    public static function activate(): Action
    {
        return Action::make('activate')
            ->label('Activate client')
            ->icon(Heroicon::OutlinedCheckBadge)
            ->color('success')
            ->requiresConfirmation()
            ->modalDescription('Activation only confirms onboarding is complete. It does not start a service or imply a payment.')
            ->visible(fn (Client $record) => auth()->user()->can('onboard', $record) && $record->onboarding_status !== OnboardingService::ACTIVE && $record->onboarding_status !== OnboardingService::CLOSED)
            ->action(fn (Client $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(OnboardingService::class)->activate(auth()->user(), $record),
                'Client activated',
            ));
    }

    public static function hold(): Action
    {
        return Action::make('hold')
            ->label('Put on hold')
            ->icon(Heroicon::OutlinedPauseCircle)
            ->color('warning')
            ->visible(fn (Client $record) => auth()->user()->can('onboard', $record) && in_array($record->onboarding_status, [OnboardingService::ONBOARDING, OnboardingService::ACTIVE], true))
            ->schema([Textarea::make('reason')->required()->minLength(3)->maxLength(1000)->rows(2)])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(OnboardingService::class)->transition($record, OnboardingService::ON_HOLD, auth()->user(), $data['reason']),
                'Client put on hold',
            ));
    }

    public static function close(): Action
    {
        return Action::make('close')
            ->label('Close relationship')
            ->icon(Heroicon::OutlinedArchiveBox)
            ->color('danger')
            ->visible(fn (Client $record) => auth()->user()->can('onboard', $record) && $record->onboarding_status !== OnboardingService::CLOSED)
            ->schema([Textarea::make('reason')->required()->minLength(3)->maxLength(1000)->rows(2)])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(OnboardingService::class)->transition($record, OnboardingService::CLOSED, auth()->user(), $data['reason']),
                'Relationship closed',
            ));
    }

    public static function completeStep(): Action
    {
        return Action::make('completeStep')
            ->label('Complete a step')
            ->icon(Heroicon::OutlinedCheck)
            ->color('gray')
            ->visible(fn (Client $record) => auth()->user()->can('onboard', $record))
            ->schema(fn (Client $record) => [
                Select::make('key')
                    ->label('Step')
                    ->options($record->onboardingSteps()
                        ->whereNotIn('key', ['profile', 'agreements', 'kyc', 'risk_profile'])
                        ->where('status', '!=', 'completed')
                        ->pluck('label', 'key'))
                    ->required()
                    ->native(false),
                Textarea::make('notes')->rows(2)->maxLength(1000),
            ])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(OnboardingService::class)->completeStep(auth()->user(), $record, $data['key'], $data['notes'] ?? null),
                'Step completed',
            ));
    }

    public static function recordAcceptance(): Action
    {
        return Action::make('recordAcceptance')
            ->label('Record agreement acceptance')
            ->icon(Heroicon::OutlinedDocumentCheck)
            ->color('gray')
            ->visible(fn (Client $record) => auth()->user()->can('agreements.record') && auth()->user()->can('onboard', $record))
            ->schema(fn (Client $record) => [
                Select::make('agreement_version_id')
                    ->label('Agreement')
                    ->options(collect(app(AgreementService::class)->outstandingFor($record))
                        ->mapWithKeys(fn (AgreementVersion $version) => [$version->id => $version->agreement->title.' v'.$version->version]))
                    ->required()
                    ->native(false),
                Radio::make('method')->options([
                    'counter_signed' => 'Signed copy received and counter-signed',
                    'offline' => 'Signed offline (scan attached)',
                ])->default('counter_signed')->required(),
                Select::make('document_id')
                    ->label('Signed copy')
                    ->options(Document::query()
                        ->where(['owner_type' => 'client', 'owner_id' => $record->id])
                        ->pluck('title', 'id'))
                    ->helperText('Upload the scan under Documents first.')
                    ->required()
                    ->native(false),
            ])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run($action, fn () => app(AgreementService::class)->accept(
                client: $record,
                version: AgreementVersion::findOrFail($data['agreement_version_id']),
                method: $data['method'],
                recordedBy: auth()->user(),
                document: Document::find($data['document_id']),
            ), 'Acceptance recorded'));
    }

    public static function uploadDocument(): Action
    {
        return Action::make('uploadDocument')
            ->label('Upload document')
            ->icon(Heroicon::OutlinedArrowUpTray)
            ->color('primary')
            ->visible(fn (Client $record) => auth()->user()->can('uploadDocuments', $record))
            ->schema([
                Select::make('category')->options(config('onboarding.documents.categories'))->required()->native(false),
                FileUpload::make('file')
                    ->label('File')
                    ->required()
                    ->storeFiles(false)
                    ->acceptedFileTypes(config('onboarding.documents.allowed_mimes'))
                    ->maxSize((int) config('onboarding.documents.max_size_kb'))
                    ->helperText('PDF or image. Stored encrypted; every download is logged.'),
            ])
            ->action(fn (array $data, Client $record, Action $action) => DomainAction::run($action, fn () => app(DocumentVault::class)->store(
                auth()->user(),
                'client',
                $record->id,
                $data['category'],
                $data['file'],
                ['is_demo' => (bool) $record->is_demo],
            ), 'Document uploaded'));
    }

    public static function publishedQuestionnaire(): ?RiskQuestionnaireVersion
    {
        return app(RiskProfileService::class)->publishedQuestionnaire();
    }

    /**
     * @return list<Component>
     */
    private static function questionnaireSchema(): array
    {
        $version = self::publishedQuestionnaire();

        if ($version === null) {
            return [];
        }

        $fields = [];

        foreach ($version->questions as $question) {
            $options = $question->options->pluck('label', 'value')->all();

            $fields[] = $question->type === RiskQuestion::MULTI
                ? CheckboxList::make('answers.'.$question->code)->label($question->text)->options($options)->columns(2)->required($question->is_required)
                : Radio::make('answers.'.$question->code)->label($question->text)->options($options)->required($question->is_required);
        }

        return [
            Section::make($version->questionnaire->title)
                ->description(new HtmlString('Methodology <strong>'.e($version->methodology_version).'</strong> · version '.$version->version))
                ->schema($fields),
        ];
    }

    public static function questionnaireName(): ?string
    {
        $version = self::publishedQuestionnaire();

        return $version === null ? null : Str::of($version->questionnaire->title)->append(' v'.$version->version)->toString();
    }

    public static function agreementTitles(): array
    {
        return Agreement::query()->where('is_active', true)->pluck('title', 'id')->all();
    }
}
