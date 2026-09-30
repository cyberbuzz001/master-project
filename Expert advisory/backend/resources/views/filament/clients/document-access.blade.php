@php($logs = $document->accessLogs()->with('user:id,name')->limit(50)->get())

<ul class="esc-rows">
    @forelse ($logs as $log)
        <li>
            <span class="esc-body">
                <span class="esc-strong">{{ str($log->action)->replace('_', ' ')->headline() }}</span>
                <span class="esc-meta">{{ $log->user?->name ?? 'System' }}{{ $log->context ? ' · '.$log->context : '' }}</span>
            </span>
            <span class="esc-end esc-meta">{{ $log->created_at->timezone(config('platform.timezone_display'))->format('d M Y, h:i A') }}</span>
        </li>
    @empty
        <li><span class="esc-muted">No access recorded yet.</span></li>
    @endforelse
</ul>
