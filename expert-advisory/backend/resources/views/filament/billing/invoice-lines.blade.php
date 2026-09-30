@php($invoice = $getRecord())

<ul class="esc-rows">
    @foreach ($invoice->items as $item)
        <li>
            <span class="esc-body">
                <span class="esc-strong">{{ $item->description }}</span>
                <span class="esc-meta">
                    {{ $item->quantity }} × {{ \App\Domain\Billing\Money::paise((int) $item->unit_price_paise)->format() }}
                    @if ((int) $item->discount_paise > 0) · less {{ \App\Domain\Billing\Money::paise((int) $item->discount_paise)->format() }}@endif
                    · tax {{ \App\Domain\Billing\Money::paise((int) $item->tax_paise)->format() }} ({{ rtrim(rtrim(number_format((float) $item->tax_rate_percent, 2), '0'), '.') }}%)
                </span>
            </span>
            <span class="esc-end esc-strong">{{ $item->lineTotal()->format() }}</span>
        </li>
    @endforeach
    <li>
        <span class="esc-strong">Total</span>
        <span class="esc-end esc-strong">{{ $invoice->grandTotal()->format() }}</span>
    </li>
</ul>
