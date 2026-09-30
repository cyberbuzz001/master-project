<?php

namespace App\Domain\Crm;

use App\Domain\Audit\AuditLogger;
use App\Domain\Shared\ApiException;
use App\Models\CallLog;
use App\Models\Followup;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\User;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Facades\DB;

/**
 * Rolls back a lead import by soft-deleting the leads it created that nobody has worked yet.
 * Leads that were called, noted, followed up or moved beyond NEW are kept and reported.
 */
final class ImportRollbackService
{
    private const UNTOUCHED_ACTIVITY_TYPES = ['imported', 'assigned'];

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @return array{removed: int, kept: int}
     */
    public function preview(Import $import): array
    {
        $leadIds = Lead::query()->withoutGlobalScopes()->where('import_id', $import->getKey())->pluck('id');
        $untouched = $this->untouchedIds($leadIds->all());

        return ['removed' => count($untouched), 'kept' => $leadIds->count() - count($untouched)];
    }

    /**
     * @return array{removed: int, kept: int}
     */
    public function rollback(User $actor, Import $import, string $reason): array
    {
        if (! $actor->can('leads.import') || ($import->user_id !== $actor->id && ! $actor->can('leads.view_all'))) {
            throw ApiException::forbidden('You cannot roll back this import.');
        }

        if ($import->rolled_back_at !== null) {
            throw new ApiException('IMPORT_ALREADY_ROLLED_BACK', 'This import has already been rolled back.', 409);
        }

        if ($import->completed_at === null) {
            throw new ApiException('IMPORT_IN_PROGRESS', 'Wait for the import to finish before rolling it back.', 409);
        }

        return DB::transaction(function () use ($actor, $import, $reason): array {
            $leadIds = Lead::query()->withoutGlobalScopes()->where('import_id', $import->getKey())->pluck('id')->all();
            $untouched = $this->untouchedIds($leadIds);

            Lead::query()->withoutGlobalScopes()->whereKey($untouched)->get()->each->delete();

            $import->forceFill([
                'rolled_back_at' => now(),
                'rolled_back_by' => $actor->id,
                'rolled_back_rows' => count($untouched),
            ])->save();

            $result = ['removed' => count($untouched), 'kept' => count($leadIds) - count($untouched)];
            $this->audit->record('lead_import.rolled_back', $import, new: $result + ['file' => $import->file_name], reason: $reason, actor: $actor);

            return $result;
        });
    }

    /**
     * @param  list<int>  $leadIds
     * @return list<int>
     */
    private function untouchedIds(array $leadIds): array
    {
        if ($leadIds === []) {
            return [];
        }

        $worked = collect()
            ->merge(Lead::query()->withoutGlobalScopes()->whereKey($leadIds)->where('status', '!=', 'NEW')->pluck('id'))
            ->merge(CallLog::query()->withoutGlobalScopes()->whereIn('lead_id', $leadIds)->pluck('lead_id'))
            ->merge(Followup::query()->withoutGlobalScopes()->whereIn('lead_id', $leadIds)->pluck('lead_id'))
            ->merge(LeadActivity::query()->whereIn('lead_id', $leadIds)->whereNotIn('type', self::UNTOUCHED_ACTIVITY_TYPES)->pluck('lead_id'))
            ->unique()
            ->all();

        return array_values(array_diff($leadIds, $worked));
    }
}
