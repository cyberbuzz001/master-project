<?php

namespace App\Filament\Widgets;

use Filament\Widgets\Widget;

class SalesTipWidget extends Widget
{
    protected static ?int $sort = 2;

    protected string $view = 'filament.widgets.sales-tip';

    public static function canView(): bool
    {
        return auth()->user()->canAny(['leads.view_own', 'leads.view_team']);
    }

    /**
     * One tip per day, the same for everyone.
     *
     * @return array{title: string, body: string}|null
     */
    public function getTip(): ?array
    {
        $tips = config('crm_playbook.tips', []);

        return $tips === [] ? null : $tips[now(config('platform.timezone_display'))->dayOfYear % count($tips)];
    }
}
