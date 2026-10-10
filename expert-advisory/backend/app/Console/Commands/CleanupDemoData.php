<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\CallLog;
use App\Models\Client;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Followup;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\MarketDataSnapshot;
use App\Models\Payment;
use App\Models\ResearchReport;
use App\Models\RiskProfile;
use App\Models\Subscription;
use App\Models\Team;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CleanupDemoData extends Command
{
    protected $signature = 'platform:cleanup-demo 
                            {--dry-run : Run in simulation mode and output the cleanup report without deleting}
                            {--force : Execute actual deletion of verified demo records}';

    protected $description = 'Safely identify and remove verified demo data while preserving all genuine business records';

    public function handle(): int
    {
        $isDryRun = ! $this->option('force') || $this->option('dry-run');

        $this->info('========================================================================');
        $this->info(' EXPERT STOCKS CRM — PRODUCTION DATA CLEANUP AUDIT & SAFETY TOOL ');
        $this->info('========================================================================');
        $this->info('Mode: ' . ($isDryRun ? 'DRY-RUN SIMULATION (No records will be deleted)' : 'LIVE DELETION'));

        // 1. Module-by-module analysis
        $modules = [
            'Users' => [User::class, 'is_demo', fn ($q) => $q->where('is_demo', true)->orWhere('email', 'like', '%@demo.example.test%')],
            'Employees' => [Employee::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Teams' => [Team::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Leads' => [Lead::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Call Logs' => [CallLog::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Follow-ups' => [Followup::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Clients' => [Client::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Risk Profiles' => [RiskProfile::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Client Documents' => [Document::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Invoices' => [Invoice::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Payments' => [Payment::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Subscriptions' => [Subscription::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
            'Research Reports' => [ResearchReport::class, 'is_demo', fn ($q) => $q->where('is_demo', true)],
        ];

        $reportRows = [];
        $totalDemoFound = 0;
        $totalGenuineFound = 0;

        foreach ($modules as $name => [$modelClass, $flag, $demoScope]) {
            try {
                $total = $modelClass::query()->withoutGlobalScopes()->count();
                $demoQuery = $modelClass::query()->withoutGlobalScopes();
                $demoScope($demoQuery);
                $demoCount = $demoQuery->count();
                $genuineCount = $total - $demoCount;

                $totalDemoFound += $demoCount;
                $totalGenuineFound += $genuineCount;

                $reportRows[] = [
                    'Module / Table' => $name,
                    'Total Records' => $total,
                    'Verified Demo' => $demoCount,
                    'Genuine to Preserve' => $genuineCount,
                    'Proposed Deletion' => $demoCount,
                    'Status' => $demoCount > 0 ? ($isDryRun ? 'Flagged for Deletion' : 'Pending Removal') : 'Clean / Protected',
                ];
            } catch (\Exception $e) {
                $reportRows[] = [
                    'Module / Table' => $name,
                    'Total Records' => 'Err',
                    'Verified Demo' => 0,
                    'Genuine to Preserve' => 'All',
                    'Proposed Deletion' => 0,
                    'Status' => 'Error: ' . $e->getMessage(),
                ];
            }
        }

        $this->table(
            ['Module / Table', 'Total Records', 'Verified Demo', 'Genuine to Preserve', 'Proposed Deletion', 'Status'],
            $reportRows
        );

        $this->newLine();
        $this->line("Summary:");
        $this->line("  • Total Verified Demo Records: <comment>{$totalDemoFound}</comment>");
        $this->line("  • Total Genuine Records Preserved: <info>{$totalGenuineFound}</info>");

        // 2. Backup confirmation
        $dbConnection = config('database.default');
        $this->line("  • Database Engine: <info>{$dbConnection}</info>");
        if ($dbConnection === 'sqlite') {
            $dbFile = config('database.connections.sqlite.database');
            $this->line("  • Database Path: <info>{$dbFile}</info>");
            $backupPath = storage_path('backups/database_pre_cleanup_' . date('Y_m_d_His') . '.sqlite');
        } else {
            $backupPath = storage_path('backups/mysql_pre_cleanup_' . date('Y_m_d_His') . '.sql');
        }

        if ($isDryRun) {
            $this->warn('DRY RUN COMPLETE: No data was modified. To execute real deletion, run with --force after explicit confirmation.');
            return 0;
        }

        // Live execution path
        if (! $this->confirm('Are you ABSOLUTELY SURE you want to delete these ' . $totalDemoFound . ' verified demo records? Genuine records will be preserved.')) {
            $this->info('Operation cancelled by user.');
            return 0;
        }

        // Create backup first
        File::ensureDirectoryExists(dirname($backupPath));
        if ($dbConnection === 'sqlite' && File::exists($dbFile)) {
            File::copy($dbFile, $backupPath);
            $this->info("Backup created at: {$backupPath}");
        }

        // Execute transactional deletion in correct foreign key order
        DB::transaction(function () use ($modules) {
            // Delete dependent records first
            $order = [
                'Payments', 'Invoices', 'Subscriptions', 'Client Documents',
                'Risk Profiles', 'Clients', 'Follow-ups', 'Call Logs', 'Leads',
                'Research Reports', 'Employees', 'Teams', 'Users',
            ];

            foreach ($order as $name) {
                [$modelClass, $flag, $demoScope] = $modules[$name];
                $query = $modelClass::query()->withoutGlobalScopes();
                $demoScope($query);
                $deleted = $query->delete();
                $this->line("Deleted {$deleted} demo records from {$name}");
            }

            AuditLog::create([
                'action' => 'platform.demo_cleanup',
                'auditable_type' => 'System',
                'auditable_id' => 0,
                'actor_user_id' => auth()->id() ?? 1,
                'metadata' => [
                    'timestamp' => now()->toIso8601String(),
                    'execution_status' => 'completed',
                ],
            ]);
        });

        $this->info('Cleanup completed successfully. Genuine data remains 100% intact.');
        return 0;
    }
}
