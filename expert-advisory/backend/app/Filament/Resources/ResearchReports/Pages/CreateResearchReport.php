<?php

namespace App\Filament\Resources\ResearchReports\Pages;

use App\Domain\Research\ResearchWorkflowService;
use App\Filament\Resources\ResearchReports\ResearchReportResource;
use App\Models\MarketDataSnapshot;
use App\Models\MessageTemplate;
use App\Models\ResearchReport;
use App\Models\Service;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Pages\CreateRecord;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Database\Eloquent\Model;

class CreateResearchReport extends CreateRecord
{
    protected static string $resource = ResearchReportResource::class;

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Report Header')
                    ->schema([
                        Grid::make(3)->schema([
                            TextInput::make('title')
                                ->required()
                                ->maxLength(255)
                                ->columnSpan(2),
                            Select::make('report_type')
                                ->options(ResearchReport::TYPES)
                                ->default(ResearchReport::TYPE_TECHNICAL)
                                ->required(),
                            Select::make('category')
                                ->options(ResearchReport::CATEGORIES)
                                ->default(ResearchReport::CATEGORY_RECOMMENDATION)
                                ->required(),
                            Select::make('data_snapshot_id')
                                ->label('Attach Market Data Snapshot')
                                ->options(fn () => MarketDataSnapshot::query()->latest('id')->limit(30)->get()->mapWithKeys(
                                    fn ($s) => [$s->id => "{$s->symbol} ({$s->exchange}) - LTP: {$s->payload['ltp']} [{$s->as_of->toDateTimeString()}]"]
                                ))
                                ->searchable(),
                            DatePicker::make('valid_until')
                                ->label('Valid Until')
                                ->minDate(now()),
                        ]),
                        Select::make('eligible_service_ids')->label('Eligible paid services')->multiple()->options(fn () => Service::query()->pluck('name', 'id'))->searchable()->helperText('Select the services entitled to this report. An empty selection grants no paid access.'),
                        Select::make('eligible_trial_types')->label('Eligible trial types')->multiple()->options(['equity' => 'Equity', 'index_options' => 'Index options', 'commodity' => 'Commodity', 'combo' => 'Combo'])->helperText('Only active approved trials matching these types receive access.'),
                        Select::make('whatsapp_template_key')->label('WhatsApp publication notification')->options(fn () => MessageTemplate::where('channel', 'whatsapp')->where('status', 'approved')->whereIn('purpose', ['research_communication', 'educational_content'])->pluck('name', 'key'))->searchable()->helperText('Optional. Uses name, report_title and portal_link variables. A document-header template must point to the reviewed material for this version. Sending requires current Meta approval, entitlement and consent.'),
                        Textarea::make('summary')
                            ->label('Executive Summary')
                            ->rows(3)
                            ->required(),
                        Textarea::make('body')
                            ->label('Technical / Fundamental Analysis Body')
                            ->rows(6)
                            ->columnSpanFull(),
                    ]),

                Section::make('Trading Recommendations')
                    ->schema([
                        Repeater::make('recommendations')
                            ->schema([
                                Grid::make(4)->schema([
                                    TextInput::make('instrument')->label('Symbol (e.g. RELIANCE)')->required()->autocapitalize(),
                                    Select::make('exchange')->options(['NSE' => 'NSE', 'BSE' => 'BSE'])->default('NSE')->required(),
                                    Select::make('segment')->options([
                                        'EQUITY_CASH' => 'Equity Cash',
                                        'EQUITY_FUTURES' => 'Futures',
                                        'EQUITY_OPTIONS' => 'Options',
                                    ])->default('EQUITY_CASH')->required(),
                                    Select::make('direction')->options([
                                        'BUY' => 'BUY',
                                        'SELL' => 'SELL',
                                        'ACCUMULATE' => 'ACCUMULATE',
                                    ])->default('BUY')->required(),
                                ]),
                                Grid::make(4)->schema([
                                    TextInput::make('entry_low')->label('Entry Low')->numeric()->required(),
                                    TextInput::make('entry_high')->label('Entry High')->numeric()->required(),
                                    TextInput::make('stop_loss')->label('Stop Loss')->numeric()->required(),
                                    TextInput::make('target')->label('Target Level')->numeric()->required(),
                                ]),
                                Grid::make(3)->schema([
                                    Select::make('risk_classification')->options([
                                        'LOW' => 'Low',
                                        'MODERATE' => 'Moderate',
                                        'HIGH' => 'High',
                                        'VERY_HIGH' => 'Very High',
                                    ])->default('MODERATE')->required(),
                                    TextInput::make('time_horizon')->default('1-3 months'),
                                    TextInput::make('invalidation_condition')->placeholder('Condition invalidating setup'),
                                ]),
                            ])
                            ->defaultItems(1)
                            ->addActionLabel('Add Recommendation'),
                    ]),
            ]);
    }

    protected function handleRecordCreation(array $data): Model
    {
        return app(ResearchWorkflowService::class)->createReport(auth()->user(), $data);
    }
}
