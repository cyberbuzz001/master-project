<x-filament-widgets::widget>
    <x-filament::section icon="heroicon-o-light-bulb" heading="Tip of the day">
        @if ($tip = $this->getTip())
            <p class="esc-tip-title">{{ $tip['title'] }}</p>
            <p class="esc-body">{{ $tip['body'] }}</p>
        @endif
    </x-filament::section>
</x-filament-widgets::widget>
