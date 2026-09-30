@php($versions = $questionnaire->versions()->with('questions.options')->get())

<div class="esc-stack">
    @forelse ($versions as $version)
        <div>
            <p class="esc-strong">
                Version {{ $version->version }} · {{ str($version->status)->headline() }}
                <span class="esc-meta">Methodology {{ $version->methodology_version }}@if ($version->published_at) · published {{ $version->published_at->timezone(config('platform.timezone_display'))->format('d M Y') }}@endif</span>
            </p>
            <ul class="esc-list">
                @foreach ($version->questions as $question)
                    <li>
                        {{ $question->text }}
                        <span class="esc-meta">weight {{ $question->weight }} · {{ $question->options->map(fn ($option) => $option->label.' ('.$option->score.')')->join(', ') }}</span>
                    </li>
                @endforeach
            </ul>
            <ul class="esc-list">
                @foreach ($version->bands ?? [] as $band)
                    <li>{{ $band['label'] }} — {{ $band['min_score'] }} to {{ $band['max_score'] }} (max possible {{ $version->maxScore() }})</li>
                @endforeach
            </ul>
        </div>
    @empty
        <p class="esc-muted">No versions drafted yet.</p>
    @endforelse
</div>
