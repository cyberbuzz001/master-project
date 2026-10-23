<?php

namespace App\Filament\Resources\Leads\Actions;

use App\Domain\Billing\Money;
use App\Domain\Compliance\ConsentRecorder;
use App\Domain\Crm\LeadAssignmentService;
use App\Domain\Crm\LeadStatus;
use App\Domain\Crm\LeadWorkflowService;
use App\Domain\Onboarding\ClientConversionService;
use App\Filament\Resources\Clients\ClientResource;
use App\Filament\Support\DomainAction;
use App\Models\CallLog;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Followup;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\SalesProposal;
use Filament\Actions\Action;
use Filament\Actions\BulkAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Support\Icons\Heroicon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Workflow actions shared by the lead table, lead view page and relation managers.
 * All state changes go through domain services; the UI never writes lifecycle fields directly.
 */
final class LeadActions
{
    public static function logCall(): Action
    {
        return Action::make('logCall')
            ->label('Log call')
            ->icon(Heroicon::OutlinedPhone)
            ->color('primary')
            ->modalHeading(fn (Lead $record) => 'Log call — '.$record->full_name)
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record) && $record->status !== 'DND')
            ->schema([
                Select::make('outcome')->options(CallLog::OUTCOMES)->required()->native(false)->live(),
                TextInput::make('duration_minutes')->label('Duration (minutes)')->numeric()->minValue(0)->maxValue(600),
                Textarea::make('notes')->rows(3)->maxLength(2000),
                DateTimePicker::make('followup_at')
                    ->label(fn (Get $get) => $get('outcome') === 'callback_requested' ? 'Call back at' : 'Next follow-up (optional)')
                    ->required(fn (Get $get) => $get('outcome') === 'callback_requested')
                    ->minDate(now())
                    ->seconds(false)
                    ->timezone(config('platform.timezone_display')),
                Select::make('followup_channel')->options(Followup::CHANNELS)->default('call')->native(false),
            ])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run($action, fn () => app(LeadWorkflowService::class)->logCall(auth()->user(), $record, [
                'outcome' => $data['outcome'],
                'duration_seconds' => filled($data['duration_minutes'] ?? null) ? (int) round($data['duration_minutes'] * 60) : null,
                'notes' => $data['notes'] ?? null,
                'followup_at' => $data['followup_at'] ?? null,
                'followup_channel' => $data['followup_channel'] ?? 'call',
            ]), 'Call logged'));
    }

    /**
     * Conversion creates the client record and the onboarding checklist. It never implies payment.
     */
    public static function convertToClient(): Action
    {
        return Action::make('convertToClient')
            ->label('Convert to client')
            ->icon(Heroicon::OutlinedIdentification)
            ->color('success')
            ->modalHeading(fn (Lead $record) => 'Convert '.$record->full_name.' to a client')
            ->modalDescription('This starts onboarding: agreements, KYC and the risk profile still have to be completed before the client is activated.')
            ->visible(fn (Lead $record) => auth()->user()->can('clients.onboard')
                && auth()->user()->can('update', $record)
                && $record->status !== LeadStatus::Dnd->value
                && ! Client::query()->where('lead_id', $record->id)->exists())
            ->schema([
                TextInput::make('full_name')->label('Full name')->required()->maxLength(255),
                TextInput::make('email')->email()->maxLength(255),
                TextInput::make('mobile')->label('Mobile')->required()->maxLength(20),
            ])
            ->fillForm(fn (Lead $record) => $record->only(['full_name', 'email', 'mobile']))
            ->action(function (array $data, Lead $record, Action $action) {
                $client = DomainAction::run($action, fn () => app(ClientConversionService::class)->convert(auth()->user(), $record, $data), 'Client created');

                if ($client !== null) {
                    $action->redirect(ClientResource::getUrl('view', ['record' => $client]));
                }
            });
    }

    public static function changeStatus(): Action
    {
        return Action::make('changeStatus')
            ->label('Change status')
            ->icon(Heroicon::OutlinedArrowsRightLeft)
            ->color('gray')
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record) && self::statusOptions($record) !== [])
            ->schema(fn (Lead $record) => [
                Select::make('status')->options(self::statusOptions($record))->required()->native(false)
                    ->helperText('Paid and Converted are set automatically when a payment is verified.'),
                Textarea::make('reason')->required()->minLength(3)->maxLength(1000)->rows(2),
            ])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(LeadWorkflowService::class)->changeStatus(auth()->user(), $record, $data['status'], $data['reason']),
                'Status updated',
            ));
    }

    public static function scheduleFollowup(): Action
    {
        return Action::make('scheduleFollowup')
            ->label('Schedule follow-up')
            ->icon(Heroicon::OutlinedCalendarDays)
            ->color('gray')
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record) && auth()->user()->can('followups.manage') && $record->status !== 'DND')
            ->schema([
                DateTimePicker::make('due_at')->required()->minDate(now())->seconds(false)->timezone(config('platform.timezone_display')),
                Select::make('channel')->options(Followup::CHANNELS)->default('call')->required()->native(false),
                Textarea::make('notes')->rows(2)->maxLength(1000),
            ])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(LeadWorkflowService::class)->scheduleFollowup(auth()->user(), $record, Carbon::parse($data['due_at']), $data['channel'], $data['notes'] ?? null),
                'Follow-up scheduled',
            ));
    }

    public static function addNote(): Action
    {
        return Action::make('addNote')
            ->label('Add note')
            ->icon(Heroicon::OutlinedPencilSquare)
            ->color('gray')
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record))
            ->schema([Textarea::make('note')->required()->maxLength(5000)->rows(4)])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(LeadWorkflowService::class)->addNote(auth()->user(), $record, $data['note']),
                'Note added',
            ));
    }

    public static function assign(): Action
    {
        return Action::make('assign')
            ->label('Assign')
            ->icon(Heroicon::OutlinedUserPlus)
            ->color('gray')
            ->visible(fn (Lead $record) => auth()->user()->can('assign', $record))
            ->schema([
                Select::make('employee_id')->label('Assign to')->options(fn () => self::assignableOptions())->searchable()->required(),
                Textarea::make('reason')->required()->maxLength(500)->rows(2),
            ])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(LeadAssignmentService::class)->assign(auth()->user(), $record, Employee::query()->findOrFail($data['employee_id']), $data['reason']),
                'Lead assigned',
            ));
    }

    public static function bulkAssign(): BulkAction
    {
        return BulkAction::make('bulkAssign')
            ->label('Assign selected')
            ->icon(Heroicon::OutlinedUserPlus)
            ->visible(fn () => auth()->user()->can('leads.assign'))
            ->schema([
                Select::make('employee_id')->label('Assign to')->options(fn () => self::assignableOptions())->searchable()->required(),
                Textarea::make('reason')->required()->maxLength(500)->rows(2),
            ])
            ->deselectRecordsAfterCompletion()
            ->action(function (array $data, Collection $records, BulkAction $action): void {
                $employee = Employee::query()->findOrFail($data['employee_id']);
                DomainAction::run($action, function () use ($records, $employee, $data): void {
                    foreach ($records as $lead) {
                        app(LeadAssignmentService::class)->assign(auth()->user(), $lead, $employee, $data['reason']);
                    }
                }, $records->count().' leads assigned');
            });
    }

    public static function clearDuplicate(): Action
    {
        return Action::make('clearDuplicate')
            ->label('Not a duplicate')
            ->icon(Heroicon::OutlinedCheckBadge)
            ->color('gray')
            ->visible(fn (Lead $record) => $record->duplicate_of_lead_id !== null && auth()->user()->can('update', $record))
            ->schema([Textarea::make('reason')->required()->maxLength(500)->rows(2)])
            ->action(fn (array $data, Lead $record, Action $action) => DomainAction::run(
                $action,
                fn () => app(LeadWorkflowService::class)->clearDuplicateFlag(auth()->user(), $record, $data['reason']),
                'Duplicate flag cleared',
            ));
    }

    /**
     * Tap-to-call is always available (calls happen on the employee's phone); it is hidden for DND leads.
     */
    public static function dial(): Action
    {
        return Action::make('dial')
            ->label('Call')
            ->icon(Heroicon::OutlinedDevicePhoneMobile)
            ->color('success')
            ->url(fn (Lead $record) => 'tel:'.$record->mobile)
            ->visible(fn (Lead $record) => filled($record->mobile) && $record->status !== 'DND'
                && app(ConsentRecorder::class)->hasConsent('lead', $record->id, 'calls'));
    }

    /**
     * WhatsApp deep link only when WhatsApp consent is on record.
     */
    public static function whatsapp(): Action
    {
        return Action::make('whatsapp')
            ->label('WhatsApp')
            ->icon(Heroicon::OutlinedChatBubbleLeftRight)
            ->color('success')
            ->visible(fn (Lead $record) => filled($record->mobile) && $record->status !== 'DND'
                && app(ConsentRecorder::class)->hasConsent('lead', $record->id, 'whatsapp'));
    }

    public static function startFreeTrial(): Action
    {
        return Action::make('startFreeTrial')
            ->label('Start free trial')
            ->icon(Heroicon::OutlinedSparkles)
            ->color('warning')
            ->modalHeading(fn (Lead $record) => 'Enroll '.$record->full_name.' in Free Trial')
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record) && $record->status !== 'DND')
            ->schema([
                Select::make('trial_type')
                    ->label('Segment')
                    ->options([
                        'equity' => 'Equity Intraday',
                        'index_options' => 'Index F&O (Nifty/BankNifty)',
                        'commodity' => 'MCX Commodity',
                        'combo' => 'Combo Research Trial',
                    ])
                    ->default('index_options')
                    ->required(),
                TextInput::make('duration_days')->label('Duration (Days)')->numeric()->default(2)->required(),
                Textarea::make('scope_description')
                    ->label('Trial scope & limitations')
                    ->default('2 trading sessions; 1 recommendation per session; strict stop-loss adherence.')
                    ->rows(2),
            ])
            ->action(function (array $data, Lead $record, Action $action) {
                FreeTrial::create([
                    'trial_code' => 'TR-' . strtoupper(Str::random(6)),
                    'lead_id' => $record->id,
                    'employee_id' => auth()->user()->employee?->id,
                    'trial_type' => $data['trial_type'],
                    'start_date' => today(),
                    'end_date' => today()->addDays((int) $data['duration_days']),
                    'interim_checkin_date' => today()->addDay(),
                    'review_meeting_date' => today()->addDays((int) $data['duration_days']),
                    'scope_description' => $data['scope_description'] ?? null,
                    'status' => 'active',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                $record->update(['status' => 'FOLLOWUP_SCHEDULED']);
                Notification::make()->success()->title('48-hour free trial activated! Follow-up check-in scheduled.')->send();
            });
    }

    public static function createProposal(): Action
    {
        return Action::make('createProposal')
            ->label('Draft proposal')
            ->icon(Heroicon::OutlinedDocumentCheck)
            ->color('info')
            ->modalHeading(fn (Lead $record) => 'Draft Advisory Proposal for '.$record->full_name)
            ->visible(fn (Lead $record) => auth()->user()->can('update', $record) && $record->status !== 'DND')
            ->schema([
                TextInput::make('package_name')->label('Package title')->default('Index Momentum Advisory (Quarterly)')->required(),
                TextInput::make('duration_days')->label('Duration (Days)')->numeric()->default(90)->required(),
                TextInput::make('final_agreed_amount_rupees')->label('Net Agreed Fee (₹)')->numeric()->default(15000)->required(),
                TextInput::make('installment_count')->label('Installments')->numeric()->default(1)->minValue(1)->maxValue(4)->required(),
                Textarea::make('payment_terms')->label('Payment terms')->default('100% upfront before service activation.')->rows(2),
            ])
            ->action(function (array $data, Lead $record, Action $action) {
                $finalPaise = Money::rupees((float) $data['final_agreed_amount_rupees'])->paise;
                SalesProposal::create([
                    'proposal_number' => 'PROP-' . date('ymd') . '-' . strtoupper(Str::random(4)),
                    'lead_id' => $record->id,
                    'employee_id' => auth()->user()->employee?->id,
                    'package_name' => $data['package_name'],
                    'duration_days' => $data['duration_days'],
                    'approved_service_fee_paise' => $finalPaise,
                    'final_agreed_amount_paise' => $finalPaise,
                    'installment_count' => $data['installment_count'],
                    'payment_terms' => $data['payment_terms'],
                    'status' => 'sent',
                    'expires_at' => today()->addDays(7),
                    'created_by' => auth()->id(),
                ]);

                $record->update(['status' => 'EXPECTED_PAYMENT']);
                Notification::make()->success()->title('Proposal drafted and recorded! Lead marked as Expected Payment.')->send();
            });
    }

    /**
     * @return array<string, string>
     */
    private static function statusOptions(Lead $lead): array
    {
        $current = LeadStatus::tryFrom($lead->status);
        if ($current === null) {
            return [];
        }

        $options = [];
        foreach ($current->manualTransitions() as $value) {
            $options[$value] = LeadStatus::from($value)->getLabel();
        }

        return $options;
    }

    /**
     * @return array<int, string>
     */
    private static function assignableOptions(): array
    {
        return app(LeadAssignmentService::class)->assignableEmployees(auth()->user())
            ->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()])
            ->all();
    }

    public static function toggleAiPause(): Action
    {
        return Action::make('toggleAiPause')
            ->label(fn (Lead $record) => $record->is_ai_paused ? 'Resume AI Assistant' : 'Take Over Chat (Pause AI)')
            ->icon(fn (Lead $record) => $record->is_ai_paused ? Heroicon::OutlinedPlay : Heroicon::OutlinedPause)
            ->color(fn (Lead $record) => $record->is_ai_paused ? 'success' : 'warning')
            ->requiresConfirmation()
            ->modalHeading(fn (Lead $record) => $record->is_ai_paused ? 'Resume AI Assistant Automation' : 'Human Agent Takeover')
            ->modalDescription(fn (Lead $record) => $record->is_ai_paused
                ? 'Resume AI sales assistant conversation for this lead. Automated AI responses will be enabled.'
                : 'Pause AI sales assistant to prevent automated responses while a human agent interacts with the customer on WhatsApp.')
            ->action(function (Lead $record) {
                $record->update(['is_ai_paused' => !$record->is_ai_paused]);
                Notification::make()
                    ->title($record->is_ai_paused ? 'Human Takeover Activated' : 'AI Assistant Resumed')
                    ->body($record->is_ai_paused ? 'AI responses are paused. You now have full manual control.' : 'AI assistant is now active for this lead.')
                    ->success()
                    ->send();
            });
    }

    public static function recalculateScore(): Action
    {
        return Action::make('recalculateScore')
            ->label('Calculate AI Score')
            ->icon(Heroicon::OutlinedSparkles)
            ->color('info')
            ->action(function (Lead $record) {
                $result = app(\App\Domain\Crm\LeadScoringEngine::class)->scoreLead($record);
                Notification::make()
                    ->title("AI Score: {$result['score']}/100 ({$result['grade']})")
                    ->body(implode(' ', $result['explanation']))
                    ->info()
                    ->send();
            });
    }
}
