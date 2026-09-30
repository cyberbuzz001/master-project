@php
    $activities = $record->activities()->with('actor:id,name')->limit(100)->get();
    $tz = config('platform.timezone_display');
@endphp
<div>
    @if ($activities->isEmpty())
        <p class="esc-muted">No activity yet.</p>
    @else
        <ol class="esc-timeline">
            @foreach ($activities as $activity)
                <li class="esc-timeline-item" data-type="{{ $activity->type }}">
                    <p class="esc-strong">{{ $activity->summary }}</p>
                    @foreach (['notes', 'full_text'] as $key)
                        @if (! empty($activity->details[$key]))
                            <p class="esc-body esc-pre">{{ $activity->details[$key] }}</p>
                        @endif
                    @endforeach
                    @if (! empty($activity->details['reason']) && $activity->type !== 'note')
                        <p class="esc-meta">Reason: {{ $activity->details['reason'] }}</p>
                    @endif
                    <p class="esc-meta">{{ $activity->occurred_at->timezone($tz)->format('d M Y, h:i A') }} · {{ $activity->actor?->name ?? 'System' }}</p>
                </li>
            @endforeach
        </ol>
    @endif
</div>
