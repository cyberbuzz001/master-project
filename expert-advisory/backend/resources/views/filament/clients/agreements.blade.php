@php
    $client = $getRecord();
    $outstanding = app(\App\Domain\Onboarding\AgreementService::class)->outstandingFor($client);
@endphp

@if ($outstanding === [])
    <p class="esc-muted">Nothing outstanding — every published agreement has been accepted.</p>
@else
    <ul class="esc-steps">
        @foreach ($outstanding as $version)
            <li class="esc-step esc-step-pending">
                <span class="esc-step-mark">○</span>
                <span class="esc-step-body">
                    <span class="esc-step-label">{{ $version->agreement->title }}</span>
                    <span class="esc-step-note">Version {{ $version->version }} · effective {{ optional($version->effective_from)->format('d M Y') ?? 'on acceptance' }}</span>
                </span>
            </li>
        @endforeach
    </ul>
@endif
