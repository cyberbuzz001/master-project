<div class="space-y-4 text-sm">
    <div class="rounded-lg bg-slate-50 p-3 border border-slate-200">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Client's Exact Statement</span>
        <p class="mt-1 font-semibold text-slate-900 text-base italic">“{{ $script->exact_client_statement ?? $script->objection }}”</p>
    </div>

    @if($script->likely_concern_hypothesis)
        <div class="rounded-lg bg-amber-50 p-3 border border-amber-200">
            <span class="text-xs font-semibold uppercase tracking-wider text-amber-700">Underlying Concern (Hypothesis)</span>
            <p class="mt-1 text-amber-900">{{ $script->likely_concern_hypothesis }}</p>
        </div>
    @endif

    <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg bg-blue-50 p-3.5 border border-blue-200">
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold uppercase tracking-wider text-blue-700">BA Script (Business Associate)</span>
            </div>
            <p class="text-blue-950 whitespace-pre-line leading-relaxed">{{ $script->response_ba ?? $script->response }}</p>
        </div>

        <div class="rounded-lg bg-indigo-50 p-3.5 border border-indigo-200">
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold uppercase tracking-wider text-indigo-700">SBA Script (Senior Associate / Closer)</span>
            </div>
            <p class="text-indigo-950 whitespace-pre-line leading-relaxed">{{ $script->response_sba ?? $script->response }}</p>
        </div>
    </div>

    @if($script->required_evidence_documentation || $script->suggested_followup_action)
        <div class="grid gap-3 sm:grid-cols-2">
            @if($script->required_evidence_documentation)
                <div class="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence / Documents to Share</span>
                    <p class="mt-1 text-slate-800 font-medium">{{ $script->required_evidence_documentation }}</p>
                </div>
            @endif

            @if($script->suggested_followup_action)
                <div class="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Suggested Action & Follow-up</span>
                    <p class="mt-1 text-slate-800 font-medium">{{ $script->suggested_followup_action }}</p>
                </div>
            @endif
        </div>
    @endif

    @if($script->approved_template)
        <div class="rounded-lg bg-emerald-50 p-3.5 border border-emerald-200">
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">Approved WhatsApp / Message Template</span>
            </div>
            <div class="bg-white p-2.5 rounded border border-emerald-200 font-mono text-xs text-emerald-950 select-all">
                {{ $script->approved_template }}
            </div>
        </div>
    @endif

    @if($script->escalation_condition)
        <div class="text-xs text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-200">
            <span class="font-bold">Escalation Rule:</span> {{ $script->escalation_condition }}
        </div>
    @endif
</div>
