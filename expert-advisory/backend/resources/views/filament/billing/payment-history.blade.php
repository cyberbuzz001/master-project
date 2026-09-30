@php($events = $payment->events()->with('actor:id,name')->get())

<ul class="esc-rows">
    @foreach ($events as $event)
        <li>
            <span class="esc-body">
                <span class="esc-strong">{{ \Illuminate\Support\Str::headline($event->type) }}</span>
                <span class="esc-meta">{{ $event->summary }}</span>
            </span>
            <span class="esc-end esc-meta">
                {{ $event->occurred_at->timezone(config('platform.timezone_display'))->format('d M Y, h:i A') }}
            </span>
        </li>
    @endforeach
</ul>
