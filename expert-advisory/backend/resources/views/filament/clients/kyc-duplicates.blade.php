<div class="esc-stack">
    <p class="esc-callout">The same identity number is recorded against these clients. Check whether this is a duplicate account before continuing.</p>
    <ul class="esc-list">
        @foreach ($clients as $client)
            <li>{{ $client->client_code }} — {{ $client->full_name }}</li>
        @endforeach
    </ul>
</div>
