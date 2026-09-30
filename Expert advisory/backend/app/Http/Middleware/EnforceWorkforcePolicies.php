<?php

namespace App\Http\Middleware;

use App\Domain\Workforce\TrainingService;
use App\Domain\Workforce\WorkforceClock;
use App\Filament\Resources\TrainingModules\TrainingModuleResource;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Back-office page requests: record attendance, enforce office hours (when switched on) and
 * send staff to their mandatory training before any other screen.
 */
class EnforceWorkforcePolicies
{
    public function __construct(
        private readonly WorkforceClock $clock,
        private readonly TrainingService $training,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->isStaff()) {
            return $next($request);
        }

        $this->clock->record($user);

        if ($this->clock->blocksAccess($user)) {
            abort(403, 'The back-office is available during office hours only.');
        }

        $onTrainingPage = $request->routeIs('filament.office.resources.training-modules.*');
        $isLogout = $request->routeIs('filament.office.auth.logout');

        if (! $onTrainingPage && ! $isLogout && $this->training->pendingMandatoryFor($user)->isNotEmpty()) {
            return redirect()->to(TrainingModuleResource::getUrl('index'));
        }

        return $next($request);
    }
}
