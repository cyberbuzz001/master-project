<?php

use App\Domain\Billing\BillingSweeper;
use App\Domain\Communications\TemplateApprovalService;
use App\Domain\Crm\AutomationWorkflowEngine;
use App\Domain\Crm\FollowupMonitor;
use App\Domain\Crm\LeadEscalationService;
use App\Domain\Crm\TrialLifecycleService;
use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Onboarding\DocumentRetentionService;
use App\Domain\Research\PerformanceLedgerService;
use App\Models\LeadImportPreview;
use App\Models\MessageTemplate;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('crm:process-automation-workflows {--limit=50}', function (AutomationWorkflowEngine $engine) {
    $limit = (int) $this->option('limit');
    $processed = $engine->processPendingActions($limit);
    $this->info("Successfully processed {$processed} automated workflow actions.");
})->purpose('Process and dispatch due automated nurturing actions while respecting quiet hours and suppression rules');

Schedule::command('crm:process-automation-workflows')->everyMinute()->withoutOverlapping()->onOneServer();

Artisan::command('crm:followups-sweep', function (FollowupMonitor $monitor) {
    $result = $monitor->sweep();
    $this->info("Reminded {$result['reminded']}, marked {$result['missed']} missed.");
})->purpose('Send follow-up reminders and mark overdue follow-ups as missed');

Schedule::command('crm:followups-sweep')->everyFiveMinutes()->withoutOverlapping()->onOneServer();

Artisan::command('crm:escalate-stale-leads', function (LeadEscalationService $escalations) {
    $this->info('Escalated '.$escalations->sweep().' lead(s).');
})->purpose('Flag leads not contacted in time and notify owners and managers');

Schedule::command('crm:escalate-stale-leads')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();

Artisan::command('documents:retention-sweep', function (DocumentRetentionService $retention) {
    $result = $retention->sweep();
    $this->info("Marked {$result['expired']} expired, purged {$result['purged']}, {$result['due']} past retention.");
})->purpose('Mark expired client documents and, when auto-purge is enabled, destroy files past their retention date');

Schedule::command('documents:retention-sweep')->dailyAt('01:30')->withoutOverlapping()->onOneServer();

Artisan::command('billing:sweep', function (BillingSweeper $sweeper) {
    $result = $sweeper->run();
    $this->info("Expired {$result['expired']} subscription(s), marked {$result['overdue']} invoice(s) overdue, sent {$result['reminders']} renewal reminder(s).");
})->purpose('Expire finished subscriptions, flag overdue invoices and send renewal reminders');

Schedule::command('billing:sweep')->dailyAt('02:00')->withoutOverlapping()->onOneServer();

Artisan::command('research:track-performance', function (PerformanceLedgerService $service) {
    $count = $service->trackPerformance();
    $this->info("Evaluated performance for {$count} active recommendation(s).");
})->purpose('Track market outcomes, MFE/MAE and target/stop hits for active research recommendations');

Schedule::command('research:track-performance')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();

Artisan::command('market-data:snapshot {symbol} {--exchange=NSE}', function (string $symbol, MarketDataSnapshotService $service) {
    $exchange = (string) $this->option('exchange');
    $snapshot = $service->snapshotQuote($symbol, $exchange);
    $this->info("Snapshot #{$snapshot->id} created for {$snapshot->symbol} (LTP: {$snapshot->payload['ltp']}, Hash: {$snapshot->payload_sha256}).");
})->purpose('Capture a verified market data snapshot for an instrument');

Artisan::command('messages:sync-templates', function (TemplateApprovalService $service): void {
    $templates = MessageTemplate::where('channel', 'whatsapp')->whereNotNull('provider_template_name')->orderBy('provider_checked_at')->limit(50)->get();
    foreach ($templates as $template) {
        $service->syncMeta($template);
    }
    $this->info('Template approval metadata refreshed.');
})->purpose('Verify template mappings against the connected Meta account');
Schedule::command('messages:sync-templates')->hourly()->withoutOverlapping()->onOneServer();
Schedule::call(fn () => LeadImportPreview::where('expires_at', '<', now()->subDays(7))->delete())->daily()->name('crm-purge-import-previews')->withoutOverlapping()->onOneServer();

Schedule::call(fn () => WebhookEvent::where('provider', 'whatsapp')->where('status', 'processing')->where('processing_started_at', '<', now()->subMinutes(15))->update(['status' => 'review_required', 'result' => 'Worker interrupted; reconcile before retry.']))->everyFiveMinutes()->name('whatsapp-review-interrupted-events')->withoutOverlapping()->onOneServer();

Artisan::command('crm:activate-trials', function (TrialLifecycleService $service): void {
    $this->info('Activated '.$service->activateApprovedTrials().' approved trials.');
})->purpose('Activate approved trials during their trading session and schedule their review');
Schedule::command('crm:activate-trials')->everyFiveMinutes()->withoutOverlapping()->onOneServer();
