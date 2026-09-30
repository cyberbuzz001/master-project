@php
    $labels = ['data_processing' => 'Store & respond', 'calls' => 'Phone calls', 'whatsapp' => 'WhatsApp', 'marketing_email' => 'Educational email'];
    $latest = $record->consents()->get()->unique('purpose')->keyBy('purpose');
    $tz = config('platform.timezone_display');
@endphp
<ul class="esc-rows">
    @foreach ($labels as $purpose => $label)
        @php($c = $latest->get($purpose))
        <li>
            <span class="esc-body">{{ $label }}</span>
            @if ($c === null)
                <span class="esc-meta">Not recorded</span>
            @elseif ($c->granted)
                <span class="esc-end"><span class="esc-ok">Granted</span><span class="esc-meta">{{ $c->captured_at->timezone($tz)->format('d M Y') }} · {{ str_replace('_', ' ', $c->channel) }}</span></span>
            @else
                <span class="esc-end"><span class="esc-no">Not given</span><span class="esc-meta">{{ $c->captured_at->timezone($tz)->format('d M Y') }}</span></span>
            @endif
        </li>
    @endforeach
</ul>
