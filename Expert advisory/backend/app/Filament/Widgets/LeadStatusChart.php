<?php

namespace App\Filament\Widgets;

use App\Domain\Crm\LeadStatus;
use App\Models\Lead;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\DB;

class LeadStatusChart extends ChartWidget
{
    protected static ?int $sort = 3;

    protected ?string $heading = 'Pipeline by status';

    protected ?string $maxHeight = '260px';

    private const COLORS = [
        'info' => '#0ea5e9', 'warning' => '#f59e0b', 'primary' => '#1f56d6',
        'success' => '#10b981', 'gray' => '#94a3b8', 'danger' => '#e11d48',
    ];

    public static function canView(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']);
    }

    protected function getData(): array
    {
        $counts = Lead::query()->visibleTo(auth()->user())
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $statuses = array_values(array_filter(LeadStatus::cases(), fn (LeadStatus $s) => ($counts[$s->value] ?? 0) > 0));

        return [
            'datasets' => [[
                'data' => array_map(fn (LeadStatus $s) => $counts[$s->value], $statuses),
                'backgroundColor' => array_map(fn (LeadStatus $s) => self::COLORS[$s->getColor()] ?? '#94a3b8', $statuses),
                'borderWidth' => 0,
            ]],
            'labels' => array_map(fn (LeadStatus $s) => $s->getLabel(), $statuses),
        ];
    }

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => ['legend' => ['position' => 'right']],
            'cutout' => '62%',
        ];
    }
}
