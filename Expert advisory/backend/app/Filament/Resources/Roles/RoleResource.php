<?php

namespace App\Filament\Resources\Roles;

use App\Filament\Resources\Roles\Pages\ManageRoles;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use Spatie\Permission\Models\Role;
use UnitEnum;

/**
 * Read-only: roles are defined in config/rbac.php and applied with `php artisan rbac:sync`,
 * so permission changes are version-controlled and reviewed like code.
 */
class RoleResource extends Resource
{
    protected static ?string $model = Role::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedKey;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 3;

    protected static ?string $navigationLabel = 'Roles & permissions';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('roles.view');
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
        return parent::getEloquentQuery()->withCount(['users', 'permissions'])->with('permissions:id,name,module,label');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id')
            ->paginated(false)
            ->columns([
                TextColumn::make('label')->weight('medium')->description(fn (Role $record) => $record->name),
                TextColumn::make('users_count')->label('Users')->numeric(),
                TextColumn::make('permissions_count')->label('Permissions')->numeric(),
                IconColumn::make('requires_2fa')->label('2FA required')->boolean(),
                IconColumn::make('is_privileged')->label('Privileged')->boolean(),
                IconColumn::make('is_staff')->label('Staff')->boolean(),
            ])
            ->recordActions([
                Action::make('permissions')
                    ->label('View permissions')
                    ->icon(Heroicon::OutlinedEye)
                    ->modalSubmitAction(false)
                    ->modalHeading(fn (Role $record) => $record->label)
                    ->modalContent(function (Role $record): HtmlString {
                        $html = '<div class="esc-stack">';
                        foreach ($record->permissions->sortBy('name')->groupBy('module') as $module => $permissions) {
                            $html .= '<div><p class="esc-strong">'.e(ucfirst((string) $module)).'</p><ul class="esc-list">';
                            foreach ($permissions as $permission) {
                                $html .= '<li>'.e($permission->label).' <span class="esc-meta" style="display:inline">'.e($permission->name).'</span></li>';
                            }
                            $html .= '</ul></div>';
                        }

                        return new HtmlString($html.'</div>');
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageRoles::route('/')];
    }
}
