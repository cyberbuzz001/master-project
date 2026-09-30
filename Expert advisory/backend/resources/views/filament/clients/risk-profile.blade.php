@php
    $client = $getRecord();
    $profile = $client->riskProfiles()->with('questionnaireVersion')->first();
    $band = $profile?->questionnaireVersion?->bandFor($profile->raw_score);
    $labels = $profile?->questionnaireVersion?->bandLabels() ?? [];
@endphp

@if ($profile === null)
    <p class="esc-muted">No assessment recorded yet. Use <strong>Risk assessment</strong> to complete one with the client.</p>
@else
    <div class="esc-kv">
        <div><span>Category</span><strong>{{ $labels[$profile->risk_category] ?? $profile->risk_category }}</strong></div>
        <div><span>Score</span><strong>{{ $profile->raw_score }} / {{ $profile->max_score }} ({{ $profile->scorePercent() }}%)</strong></div>
        <div><span>Methodology</span><strong>{{ $profile->methodology_version }}</strong></div>
        <div><span>Status</span><strong>{{ str($profile->status)->headline() }}</strong></div>
        <div><span>Taken</span><strong>{{ $profile->created_at->timezone(config('platform.timezone_display'))->format('d M Y') }}</strong></div>
        @if ($profile->expires_at)
            <div><span>Re-profile by</span><strong>{{ $profile->expires_at->timezone(config('platform.timezone_display'))->format('d M Y') }}</strong></div>
        @endif
    </div>

    @if ($band && ! empty($band['description']))
        <p class="esc-muted">{{ $band['description'] }}</p>
    @endif

    @if (! empty($profile->suitability_flags))
        <p class="esc-callout">Suitability notes: {{ collect($profile->suitability_flags)->map(fn ($flag) => str($flag)->replace('_', ' ')->headline())->join(', ') }}</p>
    @endif

    @if ($profile->acknowledged_at === null)
        <p class="esc-callout">Waiting for the client to acknowledge the outcome.</p>
    @endif

    @if ($profile->isExpired())
        <p class="esc-callout">This profile is past its review date — ask the client to retake it.</p>
    @endif

    @if ($profile->overrides()->exists())
        @php($override = $profile->overrides()->with('author')->first())
        <p class="esc-callout">Category overridden by {{ $override->author?->name ?? 'a reviewer' }}: {{ $override->reason }}</p>
    @endif
@endif
