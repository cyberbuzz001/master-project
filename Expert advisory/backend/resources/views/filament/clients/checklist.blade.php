@php
    $client = $getRecord();
    $steps = app(\App\Domain\Onboarding\OnboardingService::class)->refresh($client);
    $icons = [
        'completed' => ['✓', 'esc-step-done'],
        'skipped' => ['–', 'esc-step-skipped'],
        'blocked' => ['!', 'esc-step-blocked'],
    ];
@endphp

<ul class="esc-steps">
    @foreach ($steps as $step)
        @php([$mark, $class] = $icons[$step->status] ?? ['○', 'esc-step-pending'])
        <li class="esc-step {{ $class }}">
            <span class="esc-step-mark">{{ $mark }}</span>
            <span class="esc-step-body">
                <span class="esc-step-label">{{ $step->label }}</span>
                @unless ($step->is_required)
                    <span class="esc-step-optional">optional</span>
                @endunless
                @if ($step->notes)
                    <span class="esc-step-note">{{ $step->notes }}</span>
                @endif
                @if ($step->completed_at)
                    <span class="esc-step-note">{{ $step->completed_at->timezone(config('platform.timezone_display'))->format('d M Y, h:i A') }}</span>
                @endif
            </span>
        </li>
    @endforeach
</ul>
