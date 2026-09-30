@php($play = config('crm_playbook.statuses.'.$record->status))
<div class="esc-stack">
    @if ($play)
        <p class="esc-body">{{ $play['definition'] }}</p>
        @foreach (['required_actions' => 'Do now', 'checklist' => 'Checklist'] as $key => $heading)
            @if (! empty($play[$key]))
                <div>
                    <p class="esc-strong">{{ $heading }}</p>
                    <ul class="esc-list">
                        @foreach ($play[$key] as $item)
                            <li>{{ $item }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
        @endforeach
        <p class="esc-callout"><strong>Next:</strong> {{ $play['next_step'] }}</p>
    @else
        <p class="esc-muted">No playbook for this status.</p>
    @endif
</div>
