{{--
    Risk profile report. Every figure comes from the stored assessment; nothing is generated text.
    Entity details are printed only from a verified regulatory profile, and are omitted otherwise.
--}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $reportNumber }}</title>
    <style>
        @page { margin: 34px 38px; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 11px; line-height: 1.5; }
        .head { border-bottom: 2px solid #1f56d6; padding-bottom: 10px; margin-bottom: 16px; }
        .brand { font-size: 17px; font-weight: bold; color: #0f172a; }
        .muted { color: #64748b; }
        .small { font-size: 9.5px; }
        h2 { font-size: 12px; margin: 18px 0 6px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 5px 6px; text-align: left; vertical-align: top; }
        .kv td:first-child { color: #64748b; width: 36%; }
        .rows th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
        .rows td { border-top: 1px solid #e2e8f0; }
        .score { text-align: right; white-space: nowrap; }
        .band { background: #eef4ff; border-radius: 6px; padding: 10px 12px; margin-top: 8px; }
        .band b { font-size: 14px; color: #1a45ad; }
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
                <div class="brand">{{ $entity?->status === 'verified' ? ($entity->brand_name ?: $entity->legal_entity_name) : config('app.name') }}</div>
                @if ($entity?->status === 'verified' && $entity->legal_entity_name)
                    <div class="muted small">{{ $entity->legal_entity_name }}</div>
                @endif
                <div class="muted small">Risk profile report</div>
            </td>
            <td style="text-align: right;">
                <div><b>{{ $reportNumber }}</b></div>
                <div class="muted small">Issued {{ $generatedAt->format('d M Y, h:i A') }} IST</div>
                @if ($profile->is_demo)
                    <div class="demo small">DEMO DATA — NOT A REAL CLIENT</div>
                @endif
            </td>
        </tr>
    </table>
</div>

<table class="kv">
    <tr><td>Client</td><td><b>{{ $client->full_name }}</b> ({{ $client->client_code }})</td></tr>
    <tr><td>Assessment taken</td><td>{{ $profile->created_at->timezone(config('platform.timezone_display'))->format('d M Y, h:i A') }} IST</td></tr>
    <tr><td>Questionnaire</td><td>{{ $version->questionnaire->title }} — version {{ $version->version }}</td></tr>
    <tr><td>Scoring methodology</td><td>{{ $profile->methodology_version }}</td></tr>
    <tr><td>Answers hash (SHA-256)</td><td class="small">{{ $profile->answers_sha256 }}</td></tr>
    @if ($profile->expires_at)
        <tr><td>Review due</td><td>{{ $profile->expires_at->timezone(config('platform.timezone_display'))->format('d M Y') }}</td></tr>
    @endif
</table>

<div class="band">
    <b>{{ $band['label'] ?? $profile->risk_category }}</b>
    <span class="muted">— score {{ $profile->raw_score }} out of {{ $profile->max_score }}</span>
    @if (! empty($band['description']))
        <div>{{ $band['description'] }}</div>
    @endif
    @if ($profile->overrides()->exists())
        @php($override = $profile->overrides()->first())
        <div class="small">Category set by review from “{{ $override->from_category }}” to “{{ $override->to_category }}”. Reason on file: {{ $override->reason }}</div>
    @endif
</div>

<h2>Your answers</h2>
<table class="rows">
    <tr><th>Question</th><th>Answer</th><th class="score">Score</th></tr>
    @foreach ($answers as $answer)
        <tr>
            <td>{{ $answer->question?->text ?? $answer->question_code }}</td>
            <td>{{ $answer->answer_label }}</td>
            <td class="score">{{ $answer->score_awarded }}</td>
        </tr>
    @endforeach
    <tr>
        <td colspan="2"><b>Total</b></td>
        <td class="score"><b>{{ $profile->raw_score }} / {{ $profile->max_score }}</b></td>
    </tr>
</table>

@if (! empty($profile->suitability_flags))
    <h2>Points to keep in mind</h2>
    <ul>
        @foreach ($profile->suitability_flags as $flag)
            <li>{{ \Illuminate\Support\Str::of($flag)->replace('_', ' ')->ucfirst() }}</li>
        @endforeach
    </ul>
@endif

<div class="notice">
    This report records how you described your circumstances on the date shown. It is not investment advice and
    not a recommendation to buy or sell any security. Investments in the securities market are subject to market
    risks; read all related documents carefully before investing. No return is promised or implied. Tell us
    whenever your circumstances change so the profile can be taken again.
</div>

<div class="verify">
    <table>
        <tr>
            <td style="width: 104px;"><img src="{{ $qr }}" alt="Verification QR code"></td>
            <td>
                <div><b>Verify this report</b></div>
                <div class="small muted">{{ $verificationUrl }}</div>
                <div class="small muted">Scan or open the link to confirm this report was issued by us and has not been superseded.</div>
                @if ($entity?->status === 'verified')
                    <div class="small muted">
                        {{ $entity->research_status }}@if ($entity->registration_number) · Registration {{ $entity->registration_number }}@endif
                        @if ($entity->grievance_officer_email) · Grievances: {{ $entity->grievance_officer_email }}@endif
                    </div>
                @endif
            </td>
        </tr>
    </table>
</div>
</body>
</html>
