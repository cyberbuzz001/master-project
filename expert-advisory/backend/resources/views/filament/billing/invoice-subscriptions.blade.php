@php($subscriptions = $getRecord()->subscriptions()->with('planVersion.plan')->get())

<ul class="esc-rows">
    @forelse ($subscriptions as $subscription)
        <li>
            <span class="esc-body">
                <span class="esc-strong">{{ $subscription->planVersion->plan->name }}</span>
                <span class="esc-meta">
                    {{ \Illuminate\Support\Str::headline($subscription->status) }}
                    @if ($subscription->ends_on) · until {{ $subscription->ends_on->format('d M Y') }}@endif
                </span>
            </span>
        </li>
    @empty
        <li><span class="esc-muted">No service is attached to this invoice.</span></li>
    @endforelse
</ul>

<p class="esc-meta">A service starts only when a verified payment settles this invoice.</p>
