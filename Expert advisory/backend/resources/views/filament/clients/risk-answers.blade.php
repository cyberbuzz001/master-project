@php($answers = $profile->answers()->with('question')->get())

<div class="esc-stack">
    <p class="esc-muted">Methodology {{ $profile->methodology_version }} · answers hash {{ \Illuminate\Support\Str::limit($profile->answers_sha256, 16) }}</p>
    <ul class="esc-rows">
        @foreach ($answers as $answer)
            <li>
                <span class="esc-body">
                    <span class="esc-strong">{{ $answer->question?->text ?? $answer->question_code }}</span>
                    <span class="esc-meta">{{ $answer->answer_label }}</span>
                </span>
                <span class="esc-end esc-strong">{{ $answer->score_awarded }}</span>
            </li>
        @endforeach
        <li>
            <span class="esc-strong">Total</span>
            <span class="esc-end esc-strong">{{ $profile->raw_score }} / {{ $profile->max_score }}</span>
        </li>
    </ul>
</div>
