<?php

namespace App\Filament\Widgets;

use App\Domain\Compliance\ComplianceGate;
use Filament\Widgets\Widget;

class ComplianceReadinessWidget extends Widget
{
    protected static ?int $sort = 5;

    protected string $view = 'filament.widgets.compliance-readiness';

    public static function canView(): bool
    {
        return auth()->user()->canAny(['dashboard.admin.view', 'regulatory_profile.view']);
    }

    /**
     * @return list<array{key: string, label: string, passed: bool, detail: string}>
     */
    public function getChecks(): array
    {
        return app(ComplianceGate::class)->readiness(ComplianceGate::CATEGORY_RECOMMENDATION);
    }
}
