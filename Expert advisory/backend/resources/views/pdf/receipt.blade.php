@php
    $documentTitle = 'Payment receipt';
    $documentNumber = $receiptNumber;
    $documentDate = ($payment->received_at ?? $payment->created_at)->timezone(config('platform.timezone_display'))->format('d M Y');
    $isDemo = (bool) $payment->is_demo;
@endphp

@extends('pdf.billing-base')

@section('content')
    <table>
        <tr>
            <td style="width: 55%;">
                <div class="muted small">Received from</div>
                <div><b>{{ $client->full_name }}</b></div>
                <div class="small">{{ $client->client_code }}</div>
                @if ($client->email)<div class="small">{{ $client->email }}</div>@endif
            </td>
            <td>
                <div class="box">
                    <div><span class="muted small">Amount</span> <b>{{ $payment->amount()->format() }}</b></div>
                    <div><span class="muted small">Method</span> {{ $payment->methodLabel() }}</div>
                    @if ($payment->reference)
                        <div><span class="muted small">Reference</span> {{ $payment->reference }}</div>
                    @endif
                    <div><span class="muted small">Received on</span> {{ $documentDate }}</div>
                </div>
            </td>
        </tr>
    </table>

    <h2>Applied to</h2>
    <table class="rows">
        <tr>
            <th>Invoice</th>
            <th class="right">Invoice total</th>
            <th class="right">This payment</th>
            <th class="right">Balance after</th>
        </tr>
        <tr>
            <td>{{ $invoice?->invoice_number ?? 'Received on account (no invoice attached)' }}</td>
            <td class="right">{{ $invoice ? $invoice->grandTotal()->format() : '—' }}</td>
            <td class="right">{{ $payment->amount()->format() }}</td>
            <td class="right">{{ $invoice ? $invoice->balance()->format() : '—' }}</td>
        </tr>
    </table>

    <p style="margin-top: 12px;"><span class="stamp">RECEIVED</span></p>

    <p class="small muted">
        This receipt confirms the money reached us and was verified by a member of our team. It is not a
        confirmation that any service has started; services begin as set out in your agreement.
    </p>
@endsection
