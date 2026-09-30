@php
    $documentTitle = 'Tax invoice';
    $documentNumber = $invoice->invoice_number;
    $documentDate = $invoice->invoice_date->format('d M Y');
    $isDemo = (bool) $invoice->is_demo;
@endphp

@extends('pdf.billing-base')

@section('content')
    <table>
        <tr>
            <td style="width: 55%;">
                <div class="muted small">Billed to</div>
                <div><b>{{ $client['name'] ?? '' }}</b></div>
                <div class="small">{{ $client['client_code'] ?? '' }}</div>
                @if (! empty($client['email']))<div class="small">{{ $client['email'] }}</div>@endif
                @if (! empty($client['mobile']))<div class="small">{{ $client['mobile'] }}</div>@endif
                @if (! empty($client['city']) || ! empty($client['state']))
                    <div class="small">{{ collect([$client['city'] ?? null, $client['state'] ?? null])->filter()->join(', ') }}</div>
                @endif
            </td>
            <td>
                <div class="box">
                    <div><span class="muted small">Invoice date</span> {{ $invoice->invoice_date->format('d M Y') }}</div>
                    <div><span class="muted small">Due date</span> {{ $invoice->due_date->format('d M Y') }}</div>
                    @if ($invoice->place_of_supply)
                        <div><span class="muted small">Place of supply</span> {{ $invoice->place_of_supply }}</div>
                    @endif
                    <div><span class="muted small">Status</span> {{ \Illuminate\Support\Str::of($invoice->status)->replace('_', ' ')->ucfirst() }}</div>
                </div>
            </td>
        </tr>
    </table>

    <h2>Services</h2>
    <table class="rows">
        <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Discount</th>
            <th class="right">Tax</th>
            <th class="right">Amount</th>
        </tr>
        @foreach ($items as $item)
            <tr>
                <td>{{ $item->description }}</td>
                <td class="right">{{ $item->quantity }}</td>
                <td class="right">{{ \App\Domain\Billing\Money::paise((int) $item->unit_price_paise)->format() }}</td>
                <td class="right">{{ \App\Domain\Billing\Money::paise((int) $item->discount_paise)->format() }}</td>
                <td class="right">{{ \App\Domain\Billing\Money::paise((int) $item->tax_paise)->format() }} <span class="muted small">({{ rtrim(rtrim(number_format((float) $item->tax_rate_percent, 2), '0'), '.') }}%)</span></td>
                <td class="right">{{ $item->lineTotal()->format() }}</td>
            </tr>
        @endforeach
    </table>

    <table class="totals" style="margin-top: 10px;">
        <tr>
            <td class="label" style="width: 78%;">Subtotal</td>
            <td class="right">{{ \App\Domain\Billing\Money::paise((int) $invoice->subtotal_paise)->format() }}</td>
        </tr>
        @if ((int) $invoice->discount_total_paise > 0)
            <tr>
                <td class="label">Discount</td>
                <td class="right">− {{ \App\Domain\Billing\Money::paise((int) $invoice->discount_total_paise)->format() }}</td>
            </tr>
        @endif
        <tr>
            <td class="label">Tax</td>
            <td class="right">{{ \App\Domain\Billing\Money::paise((int) $invoice->tax_total_paise)->format() }}</td>
        </tr>
        <tr class="grand">
            <td class="label">Total payable</td>
            <td class="right">{{ $invoice->grandTotal()->format() }}</td>
        </tr>
        @if ((int) $invoice->amount_paid_paise > 0)
            <tr>
                <td class="label">Received</td>
                <td class="right">{{ $invoice->amountPaid()->format() }}</td>
            </tr>
            <tr>
                <td class="label">Balance</td>
                <td class="right">{{ $invoice->balance()->format() }}</td>
            </tr>
        @endif
    </table>

    <p style="margin-top: 12px;">
        @if ($invoice->status === \App\Models\Invoice::PAID)
            <span class="stamp">PAID</span>
        @elseif ($invoice->status === \App\Models\Invoice::VOID)
            <span class="stamp void">VOID</span>
            <span class="small muted">{{ $invoice->void_reason }}</span>
        @endif
    </p>

    @if ($invoice->notes)
        <p class="small">{{ $invoice->notes }}</p>
    @endif

    <p class="small muted">{{ $terms }}</p>
@endsection
