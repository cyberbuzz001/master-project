<?php

namespace App\Filament\Resources\Leads\RelationManagers;

use App\Filament\Resources\Followups\FollowupResource;
use App\Models\Followup;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class FollowupsRelationManager extends RelationManager
{
    protected static string $relationship = 'followups';

    protected static ?string $title = 'Follow-ups';

    protected static string|\BackedEnum|null $icon = Heroicon::OutlinedCalendarDays;

    public function isReadOnly(): bool
    {
        return true;
    }

    public static function getBadge(Model $ownerRecord, string $pageClass): ?string
    {
        $pending = $ownerRecord->followups()->whereIn('status', [Followup::PENDING, Followup::MISSED])->count();

        return $pending > 0 ? (string) $pending : null;
    }

    public function table(Table $table): Table
    {
        return FollowupResource::followupTable($table->defaultSort('due_at', 'desc'), showLead: false);
    }
}
