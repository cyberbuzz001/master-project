@php
    $conversations = $record->aiConversations()->with('messages')->latest('id')->get();
    $messages = $conversations->flatMap->messages->sortBy('created_at');
    $tz = config('platform.timezone_display');
@endphp

<div class="space-y-4">
    <!-- Header status banner -->
    <div class="p-3 rounded-lg border flex items-center justify-between {{ $record->is_ai_paused ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900' }}">
        <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full {{ $record->is_ai_paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse' }}"></span>
            <span class="text-sm font-semibold">
                {{ $record->is_ai_paused ? 'Human Takeover Active (AI Paused)' : 'AI Sales Assistant Active' }}
            </span>
            <span class="text-xs px-2 py-0.5 rounded bg-white/70 border text-slate-700">
                State: {{ \App\Models\Lead::AI_CONVERSATION_STATES[$record->ai_conversation_state] ?? ($record->ai_conversation_state ?: 'Idle') }}
            </span>
        </div>
        <div class="text-xs">
            Language: <strong>{{ strtoupper($record->preferred_language ?: 'EN') }}</strong>
        </div>
    </div>

    <!-- Message stream container -->
    <div class="bg-slate-50 border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3 font-sans">
        @if ($messages->isEmpty())
            <div class="text-center py-6 text-slate-400 text-sm">
                <p>No WhatsApp messages recorded yet.</p>
                <p class="text-xs mt-1">When the lead or AI interacts, conversation bubbles will appear here.</p>
            </div>
        @else
            @foreach ($messages as $msg)
                @if ($msg->sender_type === 'lead')
                    <!-- Inbound lead bubble (Left) -->
                    <div class="flex justify-start">
                        <div class="max-w-xs md:max-w-md bg-white border border-slate-200 rounded-lg rounded-tl-none p-3 shadow-sm">
                            <div class="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                <span>{{ $record->full_name }}</span>
                                <span class="font-normal">{{ $msg->created_at->timezone($tz)->format('h:i A') }}</span>
                            </div>
                            <p class="text-sm text-slate-800 whitespace-pre-line">{{ $msg->message_text }}</p>
                        </div>
                    </div>
                @else
                    <!-- Outbound AI or Agent bubble (Right) -->
                    <div class="flex justify-end">
                        <div class="max-w-xs md:max-w-md {{ $msg->sender_type === 'agent' ? 'bg-sky-50 border border-sky-200' : 'bg-emerald-50 border border-emerald-200' }} rounded-lg rounded-tr-none p-3 shadow-sm">
                            <div class="text-[11px] font-semibold {{ $msg->sender_type === 'agent' ? 'text-sky-700' : 'text-emerald-700' }} mb-1 flex items-center justify-between">
                                <span class="flex items-center space-x-1">
                                    <span>{{ $msg->sender_type === 'agent' ? 'Human Agent' : 'AI Assistant (ESC)' }}</span>
                                </span>
                                <span class="font-normal text-slate-500">{{ $msg->created_at->timezone($tz)->format('h:i A') }}</span>
                            </div>
                            <p class="text-sm text-slate-800 whitespace-pre-line">{{ $msg->message_text }}</p>
                            @if (!empty($msg->delivery_status))
                                <div class="text-[10px] text-right mt-1 text-slate-400">
                                    {{ ucfirst($msg->delivery_status) }}
                                </div>
                            @endif
                        </div>
                    </div>
                @endif
            @endforeach
        @endif
    </div>
</div>
