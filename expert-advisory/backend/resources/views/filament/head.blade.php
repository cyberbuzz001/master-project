<style>
    /* ==========================================================================
       EXPERT STOCKS CRM — EXECUTIVE FINANCIAL DESIGN SYSTEM (/office)
       ========================================================================== */

    :root {
        --esc-brand-primary: #1e40af;
        --esc-brand-accent: #3b82f6;
        --esc-success: #059669;
        --esc-warning: #d97706;
        --esc-danger: #dc2626;
        --esc-surface: #ffffff;
        --esc-surface-subtle: #f8fafc;
        --esc-border: #e2e8f0;
    }

    /* Topbar & Navigation Brand Header */
    .fi-topbar {
        border-bottom: 1px solid rgba(226, 232, 240, 0.8) !important;
        background: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(12px) !important;
    }

    .fi-sidebar {
        border-right: 1px solid rgba(226, 232, 240, 0.9) !important;
        background: #f8fafc !important;
    }

    .fi-sidebar-item-active .fi-sidebar-item-button {
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.14) 100%) !important;
        border-left: 3px solid #2563eb !important;
        border-radius: 6px !important;
        font-weight: 700 !important;
    }

    /* Executive Badges & Pills */
    .esc-demo-pill {
        display: inline-flex;
        align-items: center;
        margin-inline-start: 0.75rem;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        background: #fffbeb;
        color: #b45309;
        font-size: 0.75rem;
        font-weight: 700;
        border: 1px solid #fde68a;
        box-shadow: 0 1px 2px rgba(245, 158, 11, 0.1);
        white-space: nowrap;
    }

    .esc-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.65rem;
        border-radius: 9999px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }

    /* Cards & Widgets */
    .fi-wi-stats-overview-stat {
        border-radius: 12px !important;
        border: 1px solid #e2e8f0 !important;
        background: #ffffff !important;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 6px -2px rgba(15, 23, 42, 0.02) !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .fi-wi-stats-overview-stat:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04) !important;
        border-color: #cbd5e1 !important;
    }

    /* Tables Enhancement */
    .fi-ta-table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
    }

    .fi-ta-row:hover td {
        background-color: #f8fafc !important;
    }

    .fi-ta-header-cell {
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
        color: #64748b !important;
        background: #f8fafc !important;
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
    }

    /* Primary Action Buttons */
    .fi-btn-primary {
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%) !important;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25) !important;
        font-weight: 600 !important;
        transition: all 0.15s ease-in-out !important;
    }

    .fi-btn-primary:hover {
        background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%) !important;
        box-shadow: 0 4px 8px rgba(37, 99, 235, 0.35) !important;
    }

    /* Micro Layout Components */
    .esc-stack > * + * { margin-top: 0.75rem; }
    .esc-body { font-size: 0.875rem; line-height: 1.45rem; color: #334155; }
    .esc-strong { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
    .esc-muted { font-size: 0.875rem; color: #64748b; }
    .esc-meta { display: block; font-size: 0.75rem; color: #64748b; margin-top: 0.15rem; }
    .esc-pre { white-space: pre-line; margin-top: 0.15rem; }
    .esc-list { list-style: disc; padding-inline-start: 1.2rem; margin-top: 0.25rem; font-size: 0.875rem; color: #334155; }
    .esc-list li { margin-block: 0.2rem; }
    
    .esc-callout {
        border-radius: 8px;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        padding: 0.65rem 0.85rem;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .esc-rows { font-size: 0.875rem; }
    .esc-rows li { display: flex; justify-content: space-between; gap: 0.75rem; padding-block: 0.55rem; border-top: 1px solid #f1f5f9; }
    .esc-rows li:first-child { border-top: 0; }
    .esc-end { text-align: end; }
    .esc-ok { display: block; font-size: 0.75rem; font-weight: 700; color: #059669; }
    .esc-no { display: block; font-size: 0.75rem; font-weight: 700; color: #e11d48; }

    /* Activity & Lead Timeline */
    .esc-timeline {
        border-inline-start: 2px solid #e2e8f0;
        margin-inline-start: 0.5rem;
        padding-inline-start: 1.25rem;
    }

    .esc-timeline-item {
        position: relative;
        padding-block: 0.65rem;
    }

    .esc-timeline-item::before {
        content: "";
        position: absolute;
        inset-inline-start: -1.65rem;
        top: 0.95rem;
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 9999px;
        background: #2563eb;
        box-shadow: 0 0 0 3px #ffffff, 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .esc-timeline-item[data-type="status_changed"]::before { background: #f59e0b; }
    .esc-timeline-item[data-type="call"]::before { background: #10b981; }
    .esc-timeline-item[data-type="followup_missed"]::before { background: #ef4444; }
    .esc-timeline-item[data-type="note"]::before { background: #64748b; }
    .esc-timeline-item[data-type="escalated"]::before { background: #dc2626; }

    .esc-code {
        white-space: pre-wrap;
        word-break: break-word;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        padding: 0.85rem;
        font-size: 0.75rem;
        max-height: 18rem;
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        border: 1px solid #1e293b;
    }

    .esc-steps { font-size: 0.875rem; }
    .esc-step { display: flex; gap: 0.65rem; padding-block: 0.5rem; border-top: 1px solid #f1f5f9; }
    .esc-step:first-child { border-top: 0; }
    .esc-step-mark {
        flex: none;
        width: 1.45rem;
        height: 1.45rem;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
        background: #f1f5f9;
        color: #64748b;
    }

    .esc-step-done .esc-step-mark { background: #dcfce7; color: #047857; }
    .esc-step-blocked .esc-step-mark { background: #ffe4e6; color: #be123c; }
    .esc-step-skipped .esc-step-mark { background: #f1f5f9; color: #94a3b8; }
    .esc-step-body { display: flex; flex-direction: column; gap: 0.15rem; }
    .esc-step-label { color: #0f172a; font-weight: 600; }
    .esc-step-done .esc-step-label { color: #334155; }
    .esc-step-optional { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
    .esc-step-note { font-size: 0.75rem; color: #64748b; }

    .esc-kv { display: grid; gap: 0.45rem; font-size: 0.875rem; }
    .esc-kv > div { display: flex; justify-content: space-between; gap: 0.75rem; }
    .esc-kv span { color: #64748b; }
    .esc-kv strong { color: #0f172a; font-weight: 600; text-align: end; }
    .esc-tip-title { font-weight: 600; color: #0f172a; }

    @media (max-width: 640px) {
        .esc-demo-pill { display: none; }
    }
</style>
