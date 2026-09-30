@php($payments = $getRecord()->payments()->with('verifiedBy:id,name')->get())

<ul class="esc-rows">
    @forelse ($payments as $payment)
        <li>
            <span class="esc-body">
                <span class="esc-strong">{{ $payment->amount()->format() }} · {{ $payment->methodLabel() }}</span>
                <span class="esc-meta">
                    {{ \Illuminate\Support\Str::headline($payment->status) }}
                    @if ($payment->reference) · {{ $payment->reference }}@endif
                    @if ($payment->verifiedBy) · verified by {{ $payment->verifiedBy->name }}@endif
                </span>
            </span>
            <span class="esc-end esc-meta">
                {{ optional($payment->received_at)->timezone(config('platform.timezone_display'))->format('d M Y') ?? '—' }}
            </span>
        </li>
    @empty
        <li><span class="esc-muted">Nothing received yet.</span></li>
    @endforelse
</ul>
