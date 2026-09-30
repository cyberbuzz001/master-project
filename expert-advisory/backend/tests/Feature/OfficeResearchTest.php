<?php

namespace Tests\Feature;

use App\Domain\MarketData\MarketDataSnapshotService;
use App\Domain\Research\ResearchWorkflowService;
use App\Filament\Resources\MarketDataSnapshots\Pages\ListMarketDataSnapshots;
use App\Filament\Resources\ResearchReports\Pages\CreateResearchReport;
use App\Filament\Resources\ResearchReports\Pages\ListResearchReports;
use App\Filament\Resources\ResearchReports\Pages\ViewResearchReport;
use App\Models\MarketDataSnapshot;
use App\Models\ResearchReport;
use App\Models\ResearchVersion;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Tests\TestCase;

class OfficeResearchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel('office');
    }

    public function test_staff_can_view_research_reports_list(): void
    {
        $analyst = $this->makeStaff('research_analyst');
        $this->actingAsVerified($analyst);

        $workflow = app(ResearchWorkflowService::class);
        $report = $workflow->createReport($analyst, [
            'title' => 'Infosys Q2 Outlook',
            'report_type' => ResearchReport::TYPE_TECHNICAL,
            'summary' => 'Technical analysis for INFY.',
        ]);

        Livewire::test(ListResearchReports::class)
            ->assertSuccessful()
            ->assertSee('Infosys Q2 Outlook')
            ->assertSee($report->report_code);
    }

    public function test_analyst_can_create_research_report_via_filament(): void
    {
        $analyst = $this->makeStaff('research_analyst');
        $this->actingAsVerified($analyst);

        $snapshot = app(MarketDataSnapshotService::class)->snapshotQuote('INFY');

        Livewire::test(CreateResearchReport::class)
            ->fillForm([
                'title' => 'TCS Breakout Buy Call',
                'report_type' => ResearchReport::TYPE_TECHNICAL,
                'category' => ResearchReport::CATEGORY_RECOMMENDATION,
                'summary' => 'TCS technical setup towards 4400.',
                'body' => 'Detailed technical indicators: RSI at 58, 20 EMA bounce.',
                'data_snapshot_id' => $snapshot->id,
                'recommendations' => [
                    [
                        'instrument' => 'TCS',
                        'exchange' => 'NSE',
                        'segment' => 'EQUITY_CASH',
                        'direction' => 'BUY',
                        'entry_low' => 4180.0,
                        'entry_high' => 4220.0,
                        'stop_loss' => 4050.0,
                        'target' => 4400.0,
                        'risk_classification' => 'MODERATE',
                    ],
                ],
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('research_reports', ['title' => 'TCS Breakout Buy Call']);
        $this->assertDatabaseHas('research_recommendations', ['instrument' => 'TCS']);
    }

    public function test_market_data_snapshots_list_and_capture(): void
    {
        $analyst = $this->makeStaff('research_analyst');
        $this->actingAsVerified($analyst);

        app(MarketDataSnapshotService::class)->snapshotQuote('RELIANCE');

        Livewire::test(ListMarketDataSnapshots::class)
            ->assertSuccessful()
            ->assertSee('RELIANCE')
            ->assertActionExists('capture_snapshot');
    }
}
