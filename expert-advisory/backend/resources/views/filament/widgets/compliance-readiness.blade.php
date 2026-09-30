@php($checks = $this->getChecks())
@php($ready = collect($checks)->every(fn ($c) => $c['passed']))
<x-filament-widgets::widget>
    <x-filament::section icon="heroicon-o-shield-check" heading="Research publication readiness" :description="$ready ? 'All checks pass.' : 'Publishing research is blocked until every check passes.'">
        <ul class="esc-rows">
            @foreach ($checks as $check)
                <li>
                    <span>
                        <span class="esc-strong">{{ $check['label'] }}</span>
                        <span class="esc-meta">{{ $check['detail'] }}</span>
                    </span>
                    <span class="{{ $check['passed'] ? 'esc-ok' : 'esc-no' }}">{{ $check['passed'] ? 'Pass' : 'Blocked' }}</span>
                </li>
            @endforeach
        </ul>
    </x-filament::section>
</x-filament-widgets::widget>
