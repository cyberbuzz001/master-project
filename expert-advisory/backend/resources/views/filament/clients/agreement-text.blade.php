<div class="esc-stack">
    <p class="esc-muted">{{ $version->agreement->title }} · version {{ $version->version }} · sha256 {{ \Illuminate\Support\Str::limit($version->body_sha256, 16) }}</p>
    <div class="esc-body">
        {!! \Illuminate\Support\Str::markdown($version->body_markdown, ['html_input' => 'strip', 'allow_unsafe_links' => false]) !!}
    </div>
</div>
