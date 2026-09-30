<?php

namespace App\Domain\Workforce;

use App\Domain\Platform\RequestContext;
use App\Domain\Platform\Settings;
use App\Models\AttendanceDay;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;

/**
 * Attendance from back-office activity (first/last seen, active minutes) and office-hours rules.
 * Active minutes count gaps of up to IDLE_GAP_MINUTES between requests.
 */
final class WorkforceClock
{
    public const IDLE_GAP_MINUTES = 10;

    public function __construct(private readonly Settings $settings) {}

    public function record(User $user, ?CarbonInterface $at = null): ?AttendanceDay
    {
        $employee = $user->employee;
        if ($employee === null) {
            return null;
        }

        // Persist in the application timezone; datetime columns carry no offset.
        $at = ($at ?? now())->copy()->timezone(config('app.timezone'));
        $local = $at->copy()->timezone(config('platform.timezone_display'));
        $outside = ! $this->isWithinOfficeHours($local);

        $day = AttendanceDay::query()->where('employee_id', $employee->id)->whereDate('work_date', $local->toDateString())->first();

        if ($day === null) {
            try {
                return AttendanceDay::create([
                    'employee_id' => $employee->id,
                    'work_date' => $local->toDateString(),
                    'first_seen_at' => $at,
                    'last_seen_at' => $at,
                    'active_minutes' => 0,
                    'requests' => 1,
                    'first_ip' => RequestContext::ip(),
                    'outside_office_hours' => $outside,
                ]);
            } catch (QueryException) {
                // Concurrent first request of the day; fall through to update.
                $day = AttendanceDay::query()->where('employee_id', $employee->id)->whereDate('work_date', $local->toDateString())->firstOrFail();
            }
        }

        $gap = (int) floor($day->last_seen_at->diffInSeconds($at, true) / 60);
        $day->forceFill([
            'last_seen_at' => $at->greaterThan($day->last_seen_at) ? $at : $day->last_seen_at,
            'active_minutes' => $day->active_minutes + ($gap <= self::IDLE_GAP_MINUTES ? $gap : 0),
            'requests' => min(65535, $day->requests + 1),
            'outside_office_hours' => $day->outside_office_hours || $outside,
        ])->save();

        return $day;
    }

    public function isWithinOfficeHours(CarbonInterface $local): bool
    {
        $days = $this->settings->get('workforce.office_days', [1, 2, 3, 4, 5, 6]);
        $start = (string) $this->settings->get('workforce.office_hours_start', '09:00');
        $end = (string) $this->settings->get('workforce.office_hours_end', '19:00');

        if (! in_array($local->dayOfWeekIso, array_map('intval', (array) $days), true)) {
            return false;
        }

        $time = $local->format('H:i');

        return $time >= $start && $time <= $end;
    }

    /**
     * When enforcement is on, staff without admin access cannot use the back-office outside office hours.
     */
    public function blocksAccess(User $user, ?CarbonInterface $at = null): bool
    {
        if (! $this->settings->get('workforce.enforce_office_hours', false) || $user->can('dashboard.admin.view')) {
            return false;
        }

        return ! $this->isWithinOfficeHours(($at ?? now())->copy()->timezone(config('platform.timezone_display')));
    }
}
