@php
    $explanations = is_array($record->lead_score_explanation) 
        ? $record->lead_score_explanation 
        : json_decode($record->lead_score_explanation ?? '[]', true);
@endphp

<div class="space-y-3">
    <!-- Score & Grade Row -->
    <div class="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-200">
        <div>
            <div class="text-xs text-slate-500 font-medium uppercase tracking-wider">AI Lead Score</div>
            <div class="text-2xl font-bold text-slate-800">
                {{ $record->ai_score ?? 0 }} <span class="text-sm font-normal text-slate-400">/ 100</span>
            </div>
        </div>
        <div class="text-right">
            <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full {{ match($record->ai_grade) {
                'HOT' => 'bg-red-100 text-red-700 border border-red-200',
                'WARM' => 'bg-amber-100 text-amber-700 border border-amber-200',
                'ENGAGED' => 'bg-sky-100 text-sky-700 border border-sky-200',
                'CONVERTED' => 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                'DISQUALIFIED' => 'bg-rose-100 text-rose-700 border border-rose-200',
                default => 'bg-slate-100 text-slate-600 border border-slate-200',
            } }}">
                {{ $record->ai_grade ?: 'COLD' }}
            </span>
            <div class="text-[11px] text-slate-500 mt-1">
                Win Prob: <strong>{{ round(($record->conversion_probability ?? 0) * 100) }}%</strong>
            </div>
        </div>
    </div>

    <!-- Communication & Compliance Gating -->
    <div class="text-xs space-y-1.5 p-3 rounded-lg border bg-white border-slate-200">
        <div class="flex justify-between items-center">
            <span class="text-slate-500">Statutory Consent:</span>
            <span class="font-semibold {{ in_array($record->communication_state, ['CONSENT_VERIFIED', 'ELIGIBLE_WHATSAPP']) ? 'text-emerald-600' : 'text-slate-700' }}">
                {{ \App\Models\Lead::COMMUNICATION_STATES[$record->communication_state] ?? ($record->communication_state ?: 'Unknown') }}
            </span>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-slate-500">Conversation State:</span>
            <span class="font-medium text-slate-800">
                {{ \App\Models\Lead::AI_CONVERSATION_STATES[$record->ai_conversation_state] ?? ($record->ai_conversation_state ?: 'Idle') }}
            </span>
        </div>
        @if ($record->demo_requested_at)
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Free Demo:</span>
                <span class="font-semibold text-emerald-600">Requested / Active</span>
            </div>
        @endif
        @if ($record->appointment_requested_at)
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Advisory Appointment:</span>
                <span class="font-semibold text-sky-600">Booked</span>
            </div>
        @endif
        @if ($record->payment_link_generated_at)
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Checkout Link:</span>
                <span class="font-semibold text-purple-600">Generated</span>
            </div>
        @endif
    </div>

    <!-- Explainable Factors Breakdown -->
    @if (!empty($explanations))
        <div class="p-3 rounded-lg border bg-slate-50/50 border-slate-200">
            <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Scoring Breakdown</div>
            <ul class="text-xs space-y-1 text-slate-600">
                @foreach ($explanations as $factor)
                    <li class="flex items-start space-x-1.5">
                        <span class="text-emerald-500 mt-0.5">•</span>
                        <span>{{ $factor }}</span>
                    </li>
                @endforeach
            </ul>
        </div>
    @endif
</div>
