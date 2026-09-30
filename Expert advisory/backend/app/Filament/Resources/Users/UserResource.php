<?php

namespace App\Filament\Resources\Users;

use App\Domain\Identity\RoleAssignmentService;
use App\Domain\Identity\StaffUserService;
use App\Filament\Resources\Users\Pages\ManageUsers;
use App\Filament\Support\DomainAction;
use App\Models\Employee;
use App\Models\Team;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;
use UnitEnum;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUsers;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('users.view');
    }

    public static function canCreate(): bool
    {
        return auth()->user()->can('users.create') && auth()->user()->can('roles.assign');
    }

    public static function canEdit(Model $record): bool
    {
        return false; // edits go through audited actions below
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['roles', 'employee.team']);
    }

    /**
     * @return array<string, string>
     */
    public static function roleOptions(string $userType = User::TYPE_STAFF): array
    {
        return Role::query()->where('is_staff', $userType === User::TYPE_STAFF)->orderBy('id')->get()
            ->mapWithKeys(fn (Role $role) => [$role->name => $role->label.($role->is_privileged ? ' (privileged)' : '')])
            ->all();
    }

    /**
     * @return list<string>
     */
    public static function lockedRoles(): array
    {
        return auth()->user()->can('roles.assign_privileged') ? [] : config('rbac.privileged_roles');
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');
        $isSelf = fn (User $record) => $record->is(auth()->user());

        return $table
            ->defaultSort('name')
            ->columns([
                TextColumn::make('name')->searchable()->sortable()->weight('medium')
                    ->description(fn (User $record) => $record->email),
                TextColumn::make('roles.label')->label('Roles')->badge()->color('primary'),
                TextColumn::make('employee.team.name')->label('Team')->placeholder('—')->toggleable(),
                TextColumn::make('status')->badge()
                    ->state(fn (User $record) => $record->isLocked() ? 'locked' : $record->status)
                    ->color(fn (string $state) => match ($state) {
                        'active' => 'success',
                        'locked', 'deactivated' => 'danger',
                        default => 'warning',
                    }),
                IconColumn::make('two_factor')->label('2FA')->boolean()->state(fn (User $record) => $record->hasTwoFactorEnabled()),
                IconColumn::make('employee.is_authorized_research_person')->label('Research auth.')->boolean()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('last_login_at')->label('Last sign-in')->since($tz)->placeholder('Never')->sortable(),
            ])
            ->filters([
                SelectFilter::make('user_type')->options([User::TYPE_STAFF => 'Staff', User::TYPE_CLIENT => 'Clients']),
                SelectFilter::make('status')->options([User::STATUS_ACTIVE => 'Active', User::STATUS_SUSPENDED => 'Suspended', User::STATUS_DEACTIVATED => 'Deactivated']),
                SelectFilter::make('roles')->relationship('roles', 'label')->multiple()->preload(),
            ])
            ->recordActions([
                ActionGroup::make([
                    Action::make('editProfile')
                        ->label('Edit details')
                        ->icon(Heroicon::OutlinedPencilSquare)
                        ->visible(fn (User $record) => auth()->user()->can('users.update'))
                        ->fillForm(fn (User $record) => [
                            'name' => $record->name,
                            'mobile' => $record->mobile,
                            'designation' => $record->employee?->designation,
                            'team_id' => $record->employee?->team_id,
                            'reports_to_employee_id' => $record->employee?->reports_to_employee_id,
                        ])
                        ->schema(fn (User $record) => [
                            TextInput::make('name')->required()->maxLength(120),
                            TextInput::make('mobile')->tel()->maxLength(20)->unique('users', 'mobile', ignorable: $record),
                            TextInput::make('designation')->maxLength(120)->visible($record->employee !== null),
                            Select::make('team_id')->label('Team')->options(fn () => Team::query()->orderBy('name')->pluck('name', 'id'))->visible($record->employee !== null),
                            Select::make('reports_to_employee_id')->label('Reports to')->searchable()->visible($record->employee !== null)
                                ->options(fn () => Employee::query()->with('user:id,name')->whereKeyNot($record->employee?->id)->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()])),
                            Textarea::make('reason')->required()->maxLength(500)->rows(2),
                        ])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(StaffUserService::class)->update(auth()->user(), $record, $data, $data['reason']), 'User updated')),

                    Action::make('roles')
                        ->label('Change roles')
                        ->icon(Heroicon::OutlinedShieldCheck)
                        ->visible(fn (User $record) => auth()->user()->can('roles.assign') && ! $isSelf($record))
                        ->fillForm(fn (User $record) => ['roles' => $record->getRoleNames()->all()])
                        ->schema(fn (User $record) => [
                            CheckboxList::make('roles')
                                ->options(self::roleOptions($record->user_type))
                                ->disableOptionWhen(fn (string $value) => in_array($value, self::lockedRoles(), true))
                                ->columns(2),
                            Textarea::make('reason')->required()->maxLength(500)->rows(2),
                        ])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(RoleAssignmentService::class)->sync(auth()->user(), $record, $data['roles'] ?? [], $data['reason']), 'Roles updated')),

                    Action::make('unlock')
                        ->icon(Heroicon::OutlinedLockOpen)
                        ->visible(fn (User $record) => $record->isLocked() && auth()->user()->can('users.update'))
                        ->schema([Textarea::make('reason')->required()->maxLength(500)->rows(2)])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(StaffUserService::class)->unlock(auth()->user(), $record, $data['reason']), 'Account unlocked')),

                    Action::make('researchAuthorization')
                        ->label(fn (User $record) => $record->employee?->is_authorized_research_person ? 'Revoke research authorization' : 'Authorize for research approval')
                        ->icon(Heroicon::OutlinedAcademicCap)
                        ->visible(fn (User $record) => $record->employee !== null && ! $isSelf($record) && auth()->user()->can('research_persons.authorize'))
                        ->modalDescription('Only authorized research persons can approve research, in addition to holding the approval permission. Record the evidence you checked.')
                        ->schema([Textarea::make('reason')->label('Evidence checked')->required()->maxLength(500)->rows(3)])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(StaffUserService::class)->setResearchAuthorization(auth()->user(), $record, ! $record->employee->is_authorized_research_person, $data['reason']), 'Research authorization updated')),

                    Action::make('deactivate')
                        ->icon(Heroicon::OutlinedNoSymbol)
                        ->color('danger')
                        ->visible(fn (User $record) => $record->isActive() && ! $isSelf($record) && auth()->user()->can('users.deactivate'))
                        ->modalDescription('The user is signed out everywhere and cannot sign in until reactivated.')
                        ->schema([Textarea::make('reason')->required()->maxLength(500)->rows(2)])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(StaffUserService::class)->deactivate(auth()->user(), $record, $data['reason']), 'User deactivated')),

                    Action::make('reactivate')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->visible(fn (User $record) => ! $record->isActive() && auth()->user()->can('users.deactivate'))
                        ->schema([Textarea::make('reason')->required()->maxLength(500)->rows(2)])
                        ->action(fn (array $data, User $record, Action $action) => DomainAction::run($action,
                            fn () => app(StaffUserService::class)->reactivate(auth()->user(), $record, $data['reason']), 'User reactivated')),
                ]),
            ]);
    }

    /**
     * Staff creation form, used by the page's create action.
     *
     * @return array<int, mixed>
     */
    public static function createSchema(): array
    {
        return [
            TextInput::make('name')->required()->maxLength(120),
            TextInput::make('email')->email()->required()->maxLength(255)->unique('users', 'email'),
            TextInput::make('mobile')->tel()->maxLength(20)->unique('users', 'mobile'),
            TextInput::make('designation')->maxLength(120),
            Select::make('team_id')->label('Team')->options(fn () => Team::query()->orderBy('name')->pluck('name', 'id')),
            Select::make('reports_to_employee_id')->label('Reports to')->searchable()
                ->options(fn () => Employee::query()->with('user:id,name')->get()->mapWithKeys(fn (Employee $e) => [$e->id => $e->displayName()])),
            TextInput::make('password')
                ->label('Temporary password')
                ->password()
                ->revealable()
                ->required()
                ->rule(Password::defaults())
                ->helperText('Share securely. The user must set up two-factor authentication at first sign-in.')
                ->columnSpanFull(),
            CheckboxList::make('roles')
                ->options(self::roleOptions())
                ->disableOptionWhen(fn (string $value) => in_array($value, self::lockedRoles(), true))
                ->required()
                ->columns(2)
                ->columnSpanFull(),
            Textarea::make('reason')->required()->maxLength(500)->rows(2)->columnSpanFull(),
        ];
    }

    public static function getPages(): array
    {
        return ['index' => ManageUsers::route('/')];
    }
}
