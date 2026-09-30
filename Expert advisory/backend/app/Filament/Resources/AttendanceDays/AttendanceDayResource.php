<?php

namespace App\Filament\Resources\AttendanceDays;

use App\Filament\Resources\AttendanceDays\Pages\ManageAttendanceDays;
use App\Models\AttendanceDay;
use App\Models\Employee;
use BackedEnum;
use Filament\Forms\Components\DatePicker;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

/**
 * Activity-based attendance: first and last back-office activity per day. It records presence in the
 * system, not hours worked, and is labelled as such.
 */
class AttendanceDayResource extends Resource
{
    protected static ?string $model = AttendanceDay::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClock;

    protected static string|UnitEnum|null $navigationGroup = 'Workforce';

    protected static ?int $navigationSort = 2;

    protected static ?string $navigationLabel = 'Attendance';

    public static function canViewAny(): bool
    {
        return auth()->user()->employee !== null;
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
        return parent::getEloquentQuery()->visibleTo(auth()->user())->with('employee.user:id,name');
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('work_date', 'desc')
            ->description('Based on back-office activity (first and last request of the day). It shows presence in the system, not hours worked.')
            ->columns([
                TextColumn::make('work_date')->label('Date')->date('D, d M Y')->sortable(),
                TextColumn::make('employee.user.name')->label('Employee')->searchable(),
                TextColumn::make('first_seen_at')->label('First activity')->time('h:i A', $tz),
                TextColumn::make('last_seen_at')->label('Last activity')->time('h:i A', $tz),
                TextColumn::make('active_minutes')->label('Active time')
                    ->formatStateUsing(fn (int $state) => intdiv($state, 60).'h '.str_pad((string) ($state % 60), 2, '0', STR_PAD_LEFT).'m')
                    ->sortable(),
                IconColumn::make('outside_office_hours')->label('Outside hours')->boolean()->trueColor('warning'),
            ])
            ->filters([
                Filter::make('period')
                    ->schema([DatePicker::make('from')->default(now()->subDays(6)), DatePicker::make('until')->default(now())])
                    ->query(fn (Builder $query, array $data) => $query
                        ->when($data['from'] ?? null, fn (Builder $q, $date) => $q->whereDate('work_date', '>=', $date))
                        ->when($data['until'] ?? null, fn (Builder $q, $date) => $q->whereDate('work_date', '<=', $date))),
                SelectFilter::make('employee_id')
                    ->label('Employee')
                    ->visible(fn () => auth()->user()->canAny(['attendance.view_team', 'attendance.view_all']))
                    ->options(fn () => Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()]))
                    ->searchable(),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageAttendanceDays::route('/')];
    }
}
