<?php

namespace App\Filament\Resources\AuditLogs;

use App\Filament\Resources\AuditLogs\Pages\ManageAuditLogs;
use App\Models\AuditLog;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use UnitEnum;

class AuditLogResource extends Resource
{
    protected static ?string $model = AuditLog::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClipboardDocumentList;

    protected static string|UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Audit log';

    public static function canViewAny(): bool
    {
        return auth()->user()->can('audit.view');
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
        return parent::getEloquentQuery()->with('actor:id,name,email');
    }

    public static function table(Table $table): Table
    {
        $tz = config('platform.timezone_display');

        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('created_at')->label('Time (IST)')->dateTime('d M Y, h:i:s A', $tz)->sortable(),
                TextColumn::make('action')->fontFamily('mono')->searchable(),
                TextColumn::make('actor.name')->label('Actor')->placeholder(fn (AuditLog $record) => ucfirst($record->actor_type)),
                TextColumn::make('subject')->state(fn (AuditLog $record) => $record->subject_type ? class_basename($record->subject_type).' #'.$record->subject_id : '—'),
                TextColumn::make('reason')->limit(60)->placeholder('—')->wrap(),
                TextColumn::make('ip')->label('IP')->fontFamily('mono')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Filter::make('action_prefix')
                    ->schema([TextInput::make('prefix')->label('Action starts with')->placeholder('auth. or lead.status')])
                    ->query(fn (Builder $query, array $data) => $query->when($data['prefix'] ?? null, fn (Builder $q, string $prefix) => $q->where('action', 'like', $prefix.'%'))),
                SelectFilter::make('actor_type')->options(['user' => 'User', 'system' => 'System', 'webhook' => 'Webhook', 'ai' => 'AI']),
                Filter::make('period')
                    ->schema([DatePicker::make('from'), DatePicker::make('until')])
                    ->query(fn (Builder $query, array $data) => $query
                        ->when($data['from'] ?? null, fn (Builder $q, $date) => $q->where('created_at', '>=', $date))
                        ->when($data['until'] ?? null, fn (Builder $q, $date) => $q->where('created_at', '<', now()->parse($date)->addDay()))),
            ])
            ->recordActions([
                Action::make('details')
                    ->icon(Heroicon::OutlinedEye)
                    ->modalSubmitAction(false)
                    ->modalWidth('3xl')
                    ->modalHeading(fn (AuditLog $record) => $record->action)
                    ->modalContent(fn (AuditLog $record) => new HtmlString(
                        '<div class="esc-stack">'
                        .'<p class="esc-body"><strong>Request ID:</strong> '.e($record->request_id ?? '—').'<br><strong>IP:</strong> '.e($record->ip ?? '—').'<br><strong>Device:</strong> '.e($record->user_agent ?? '—').'</p>'
                        .'<p class="esc-strong">Before</p><pre class="esc-code">'.e(json_encode($record->old_values, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: 'null').'</pre>'
                        .'<p class="esc-strong">After</p><pre class="esc-code">'.e(json_encode($record->new_values, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: 'null').'</pre>'
                        .'</div>'
                    )),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageAuditLogs::route('/')];
    }
}
