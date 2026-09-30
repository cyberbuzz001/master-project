<style>
    .esc-demo-pill { display:inline-flex; align-items:center; margin-inline-start:.75rem; padding:.2rem .6rem; border-radius:999px; background:#fff8eb; color:#a15c07; font-size:.72rem; font-weight:600; border:1px solid #fde2a8; white-space:nowrap; }
    .esc-stack > * + * { margin-top:.75rem; }
    .esc-body { font-size:.875rem; line-height:1.4rem; color:#334155; }
    .esc-strong { font-size:.875rem; font-weight:600; color:#0f172a; }
    .esc-muted { font-size:.875rem; color:#64748b; }
    .esc-meta { display:block; font-size:.75rem; color:#64748b; margin-top:.1rem; }
    .esc-pre { white-space:pre-line; margin-top:.15rem; }
    .esc-list { list-style:disc; padding-inline-start:1.2rem; margin-top:.25rem; font-size:.875rem; color:#334155; }
    .esc-list li { margin-block:.2rem; }
    .esc-callout { border-radius:.6rem; background:#eef4ff; color:#1a45ad; padding:.55rem .75rem; font-size:.875rem; }
    .esc-rows { font-size:.875rem; }
    .esc-rows li { display:flex; justify-content:space-between; gap:.75rem; padding-block:.5rem; border-top:1px solid #f1f5f9; }
    .esc-rows li:first-child { border-top:0; }
    .esc-end { text-align:end; }
    .esc-ok { display:block; font-size:.75rem; font-weight:600; color:#059669; }
    .esc-no { display:block; font-size:.75rem; font-weight:600; color:#e11d48; }
    .esc-timeline { border-inline-start:2px solid #e2e8f0; margin-inline-start:.4rem; padding-inline-start:1.1rem; }
    .esc-timeline-item { position:relative; padding-block:.55rem; }
    .esc-timeline-item::before { content:""; position:absolute; inset-inline-start:-1.5rem; top:.85rem; width:.6rem; height:.6rem; border-radius:999px; background:#1f56d6; box-shadow:0 0 0 3px #fff; }
    .esc-timeline-item[data-type="status_changed"]::before { background:#f59e0b; }
    .esc-timeline-item[data-type="call"]::before { background:#13a58f; }
    .esc-timeline-item[data-type="followup_missed"]::before { background:#e11d48; }
    .esc-timeline-item[data-type="note"]::before { background:#64748b; }
    .esc-timeline-item[data-type="escalated"]::before { background:#e11d48; }
    .esc-code { white-space:pre-wrap; word-break:break-word; background:#0b1b2e; color:#e2e8f0; border-radius:.6rem; padding:.75rem; font-size:.75rem; max-height:18rem; overflow:auto; font-family:ui-monospace,monospace; }
    .esc-steps { font-size:.875rem; }
    .esc-step { display:flex; gap:.6rem; padding-block:.45rem; border-top:1px solid #f1f5f9; }
    .esc-step:first-child { border-top:0; }
    .esc-step-mark { flex:none; width:1.35rem; height:1.35rem; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:700; background:#f1f5f9; color:#64748b; }
    .esc-step-done .esc-step-mark { background:#dcfce7; color:#047857; }
    .esc-step-blocked .esc-step-mark { background:#ffe4e6; color:#be123c; }
    .esc-step-skipped .esc-step-mark { background:#f1f5f9; color:#94a3b8; }
    .esc-step-body { display:flex; flex-direction:column; gap:.1rem; }
    .esc-step-label { color:#0f172a; font-weight:500; }
    .esc-step-done .esc-step-label { color:#334155; }
    .esc-step-optional { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:#94a3b8; }
    .esc-step-note { font-size:.75rem; color:#64748b; }
    .esc-kv { display:grid; gap:.4rem; font-size:.875rem; }
    .esc-kv > div { display:flex; justify-content:space-between; gap:.75rem; }
    .esc-kv span { color:#64748b; }
    .esc-kv strong { color:#0f172a; font-weight:600; text-align:end; }
    .esc-tip-title { font-weight:600; color:#0f172a; }
    @media (max-width: 640px) { .esc-demo-pill { display:none; } }
</style>
