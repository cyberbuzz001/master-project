@php($versions = $plan->versions()->get())

<ul class="esc-rows">
    @forelse ($versions as $version)
        <li>
            <span class="esc-body">
                <span class="esc-strong">v{{ $version->version }} · {{ $version->price()->format() }}</span>
                <span class="esc-meta">
                    {{ config('billing.tax_codes.'.$version->tax_code.'.label', 'No tax') }} ·
                    {{ \Illuminate\Support\Str::headline($version->status) }}
                    @if ($version->effective_from) · effective {{ $version->effective_from->format('d M Y') }}@endif
                </span>
            </span>
            <span class="esc-end esc-meta">
                {{ $version->published_at?->timezone(config('platform.timezone_display'))->format('d M Y') ?? 'Draft' }}
            </span>
        </li>
    @empty
        <li><span class="esc-muted">No price published yet.</span></li>
    @endforelse
</ul>
