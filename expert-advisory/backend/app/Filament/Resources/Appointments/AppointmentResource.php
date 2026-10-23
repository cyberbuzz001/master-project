<?php

namespace App\Filament\Resources\Appointments;

use App\Filament\Resources\Appointments\Pages\ManageAppointments;
use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Lead;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class AppointmentResource extends Resource
{
    protected static ?string $model = Appointment::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCalendarDays;

    protected static string|UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 3;

    protected static ?string $navigationLabel = 'Appointments & Demos';

    protected static ?string $modelLabel = 'Appointment';

    protected static ?string $slug = 'crm/appointments';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->with(['lead:id,full_name,mobile', 'client:id,full_name,mobile', 'employee.user:id,name']);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([
            Select::make('lead_id')
                ->label('Lead Prospect')
                ->relationship('lead', 'full_name')
                ->searchable()
                ->preload(),
            Select::make('employee_id')
                ->label('Assigned Advisor / Employee')
                ->options(fn () => Employee::with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                ->searchable()
                ->required(),
            Select::make('appointment_type')
                ->label('Session Type')
                ->options([
                    'advisory_intro' => 'Advisory Introduction Call',
                    'demo_walkthrough' => 'Free Demo Research Walkthrough',
                    'portfolio_review' => 'Portfolio Risk Assessment',
                    'kyc_closing' => 'KYC & Subscription Closing',
                ])
                ->default('advisory_intro')
                ->required(),
            DateTimePicker::make('scheduled_start')
                ->label('Start Time')
                ->required()
                ->seconds(false)
                ->timezone(config('platform.timezone_display')),
            DateTimePicker::make('scheduled_end')
                ->label('End Time')
                ->required()
                ->seconds(false)
                ->timezone(config('platform.timezone_display')),
            Select::make('status')
                ->label('Status')
                ->options([
                    'scheduled' => 'Scheduled',
                    'confirmed' => 'Confirmed by Lead',
                    'completed' => 'Completed',
                    'rescheduled' => 'Rescheduled',
                    'cancelled' => 'Cancelled',
                    'no_show' => 'No Show / Missed',
                ])
                ->default('scheduled')
                ->required(),
            TextInput::make('meeting_link')
                ->label('Virtual Meeting / Call Link')
                ->url()
                ->maxLength(1024),
            Textarea::make('notes')
                ->label('Analyst Consultation Notes')
                ->rows(3),
        ]);
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('scheduled_start', 'asc')
            ->columns([
                TextColumn::make('appointment_code')
                    ->label('Code')
                    ->weight('bold')
                    ->searchable(),
                TextColumn::make('lead.full_name')
                    ->label('Lead / Contact')
                    ->searchable()
                    ->description(fn (Appointment $r) => $r->lead?->mobile ?? $r->client?->mobile),
                TextColumn::make('appointment_type')
                    ->label('Type')
                    ->badge()
                    ->color('info')
                    ->formatStateUsing(fn (string $s) => match ($s) {
                        'advisory_intro' => 'Intro Call',
                        'demo_walkthrough' => 'Demo Walkthrough',
                        'portfolio_review' => 'Portfolio Review',
                        'kyc_closing' => 'KYC Closing',
                        default => $s,
                    }),
                TextColumn::make('scheduled_start')
                    ->label('Scheduled Time')
                    ->dateTime('d M Y, h:i A', $tz)
                    ->sortable(),
                TextColumn::make('employee.user.name')
                    ->label('Assigned Analyst')
                    ->placeholder('Unassigned'),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $s) => match ($s) {
                        'completed' => 'success',
                        'confirmed' => 'primary',
                        'scheduled' => 'warning',
                        'rescheduled' => 'info',
                        'cancelled', 'no_show' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('meeting_link')
                    ->label('Link')
                    ->url(fn (Appointment $r) => $r->meeting_link, true)
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'scheduled' => 'Scheduled',
                    'confirmed' => 'Confirmed',
                    'completed' => 'Completed',
                    'rescheduled' => 'Rescheduled',
                    'cancelled' => 'Cancelled',
                    'no_show' => 'No Show',
                ]),
                SelectFilter::make('appointment_type')->options([
                    'advisory_intro' => 'Intro Call',
                    'demo_walkthrough' => 'Demo Walkthrough',
                    'portfolio_review' => 'Portfolio Review',
                    'kyc_closing' => 'KYC Closing',
                ]),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('markCompleted')
                    ->label('Mark Completed')
                    ->icon(Heroicon::OutlinedCheckCircle)
                    ->color('success')
                    ->visible(fn (Appointment $r) => in_array($r->status, ['scheduled', 'confirmed']))
                    ->action(function (Appointment $record) {
                        $record->update(['status' => 'completed']);
                        Notification::make()->title('Appointment marked as completed')->success()->send();
                    }),
            ])
            ->headerActions([
                CreateAction::make()->label('Book Appointment'),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageAppointments::route('/')];
    }
}
