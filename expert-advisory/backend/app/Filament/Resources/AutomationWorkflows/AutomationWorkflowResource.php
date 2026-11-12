<?php

namespace App\Filament\Resources\AutomationWorkflows;

use App\Filament\Resources\AutomationWorkflows\Pages\ManageAutomationWorkflows;
use App\Models\AutomationWorkflow;
use BackedEnum;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class AutomationWorkflowResource extends Resource
{
    protected static ?string $model = AutomationWorkflow::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBolt;

    protected static string|UnitEnum|null $navigationGroup = 'Marketing';

    protected static ?int $navigationSort = 3;

    protected static ?string $navigationLabel = 'AI Nurturing Workflows';

    protected static ?string $modelLabel = 'Automation Workflow';

    protected static ?string $slug = 'marketing/workflows';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('automation.manage');
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('automation.manage');
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()->can('automation.manage');
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount('runs');
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([
            TextInput::make('code')
                ->label('Workflow Code')
                ->required()
                ->unique(ignoreRecord: true)
                ->maxLength(64),
            TextInput::make('name')
                ->label('Workflow Name')
                ->required()
                ->maxLength(255),
            Select::make('trigger_event')
                ->label('Trigger Event')
                ->options([
                    'LEAD_IMPORTED' => 'Lead Imported (Workflow A)',
                    'CONSENT_GRANTED' => 'Consent Granted & Verified (Workflow B)',
                    'DEMO_REQUESTED' => 'Demo Requested (Workflow C)',
                    'APPOINTMENT_REQUESTED' => 'Appointment Requested (Workflow D)',
                    'PAYMENT_REQUESTED' => 'Payment Requested (Workflow E)',
                    'HUMAN_REQUESTED' => 'Human Handoff Requested (Workflow F)',
                    'OPT_OUT_REQUESTED' => 'Opt-Out Detected (Workflow G)',
                ])
                ->required(),
            Textarea::make('description')
                ->label('Description & Purpose')
                ->rows(3),
            Toggle::make('is_active')
                ->label('Workflow Active')
                ->default(true),
            Toggle::make('quiet_hours_enabled')
                ->label('Configured outreach hours apply to all automated sends')
                ->default(true),
            TextInput::make('quiet_hours_start')
                ->label('Quiet Hours Start (IST)')
                ->default('20:00')
                ->maxLength(8),
            TextInput::make('quiet_hours_end')
                ->label('Quiet Hours End (IST)')
                ->default('09:00')
                ->maxLength(8),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'asc')
            ->columns([
                TextColumn::make('code')->label('Code')->weight('bold')->searchable(),
                TextColumn::make('name')->label('Name')->searchable(),
                TextColumn::make('trigger_event')->label('Trigger')->badge()->color('info'),
                TextColumn::make('runs_count')->label('Executed Runs')->numeric()->sortable(),
                IconColumn::make('quiet_hours_enabled')->label('Quiet Hours')->boolean()->trueColor('success'),
                IconColumn::make('is_active')->label('Status')->boolean(),
                TextColumn::make('updated_at')->label('Last Updated')->dateTime('d M Y, h:i A')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->headerActions([
                CreateAction::make()->label('Create Workflow'),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageAutomationWorkflows::route('/')];
    }
}
