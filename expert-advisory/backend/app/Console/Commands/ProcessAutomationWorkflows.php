<?php

namespace App\Console\Commands;

use App\Domain\Crm\AutomationWorkflowEngine;
use Illuminate\Console\Command;

class ProcessAutomationWorkflows extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'crm:process-automation-workflows {--limit=50 : Maximum number of actions to execute}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process and dispatch due automated nurturing actions while respecting quiet hours and suppression rules.';

    /**
     * Execute the console command.
     */
    public function handle(AutomationWorkflowEngine $engine): int
    {
        $limit = (int) $this->option('limit');
        $this->info("Processing pending automation actions (Limit: {$limit})...");

        $processed = $engine->processPendingActions($limit);

        $this->info("Successfully processed {$processed} automated workflow actions.");

        return Command::SUCCESS;
    }
}
