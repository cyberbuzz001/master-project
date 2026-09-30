{{--
    Shared shell for billing PDFs. Entity details are printed from the snapshot taken at issue time,
    and only when that snapshot came from a verified regulatory profile.
--}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $documentTitle }}</title>
    <style>
        @page { margin: 34px 38px; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 11px; line-height: 1.5; }
        .head { border-bottom: 2px solid #1f56d6; padding-bottom: 10px; margin-bottom: 16px; }
        .brand { font-size: 17px; font-weight: bold; color: #0f172a; }
        .muted { color: #64748b; }
        .small { font-size: 9.5px; }
        .right { text-align: right; }
        h2 { font-size: 12px; margin: 16px 0 6px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 5px 6px; text-align: left; vertical-align: top; }
        .rows th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
        .rows td { border-top: 1px solid #e2e8f0; }
        .totals td { padding: 3px 6px; }
        .totals .label { color: #64748b; text-align: right; }
        .totals .grand td { border-top: 1px solid #cbd5e1; font-weight: bold; font-size: 12px; }
        .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 11px; }
        .stamp { display: inline-block; border: 2px solid #059669; color: #059669; border-radius: 6px; padding: 4px 10px; font-weight: bold; }
        .void { border-color: #e11d48; color: #e11d48; }
        .notice { border: 1px solid #fde2a8; background: #fff8eb; border-radius: 6px; padding: 9px 11px; margin-top: 14px; color: #7c4a03; }
        .verify { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .verify img { width: 92px; height: 92px; }
        .demo { color: #b45309; font-weight: bold; }
    </style>
</head>
<body>
<div class="head">
    <table>
        <tr>
            <td>
                <div class="brand">{{ $entity['brand_name'] ?? $entity['legal_entity_name'] ?? config('app.name') }}</div>
                @if (! empty($entity['legal_entity_name']))
                    <div class="muted small">{{ $entity['legal_entity_name'] }}</div>
                @endif
                @if (! empty($entity['research_status']) || ! empty($entity['registration_number']))
                    <div class="muted small">
                        {{ $entity['research_status'] ?? '' }}@if (! empty($entity['registration_number'])) · Registration {{ $entity['registration_number'] }}@endif
                    </div>
                @endif
            </td>
            <td class="right">
                <div class="brand">{{ $documentTitle }}</div>
                <div><b>{{ $documentNumber }}</b></div>
                <div class="muted small">{{ $documentDate }}</div>
                @if ($isDemo)
                    <div class="demo small">DEMO DATA — NOT A REAL TRANSACTION</div>
                @endif
            </td>
        </tr>
    </table>
</div>

@yield('content')

<div class="notice">
    Fees are for the service described above. Nothing here is a promise of profit, and past research
    outcomes do not indicate future results. Investments in the securities market are subject to market risks;
    read all related documents carefully before investing.
    @if (! empty($entity['grievance_officer_email']))
        Grievances: {{ $entity['grievance_officer_name'] ?? '' }} · {{ $entity['grievance_officer_email'] }}@if (! empty($entity['grievance_officer_phone'])) · {{ $entity['grievance_officer_phone'] }}@endif.
    @endif
</div>

<div class="verify">
    <table>
        <tr>
            <td style="width: 104px;"><img src="{{ $qr }}" alt="Verification QR code"></td>
            <td>
                <div><b>Verify this document</b></div>
                <div class="small muted">{{ $verificationUrl }}</div>
                <div class="small muted">Scan or open the link to confirm we issued it and that it still stands.</div>
                <div class="small muted">This is a computer-generated document and is valid without a signature.</div>
            </td>
        </tr>
    </table>
</div>
</body>
</html>
