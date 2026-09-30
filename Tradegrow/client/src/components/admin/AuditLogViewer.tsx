import React, { useState, useEffect } from 'react';
import { Search, Filter, FileText, Download } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { exportToCsv } from '../../utils/csvExport';

interface AuditLogViewerProps { token: string; }

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ token }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/audit-logs?limit=200', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setLogs(d.logs));
  }, [token]);

  const filtered = actionFilter ? logs.filter(l => l.action.includes(actionFilter)) : logs;
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} aria-label="Filter by action type"
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)]">
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[10px] text-[var(--text-tertiary)]">{filtered.length} entries</span>
        <button
          onClick={() => exportToCsv('audit-logs', filtered, [
            { header: 'Timestamp', value: (log: any) => new Date(log.timestamp).toLocaleString() },
            { header: 'Actor', value: (log: any) => log.actor_id },
            { header: 'Role', value: (log: any) => log.actor_role },
            { header: 'Action', value: (log: any) => log.action },
            { header: 'Resource Type', value: (log: any) => log.resource_type },
            { header: 'Resource ID', value: (log: any) => log.resource_id },
            { header: 'IP Address', value: (log: any) => log.ip_address },
            { header: 'Data', value: (log: any) => log.new_data ? JSON.stringify(log.new_data) : '' },
          ])}
          disabled={filtered.length === 0}
          className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40 transition cursor-pointer"
        >
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg overflow-hidden flex-1 overflow-y-auto p-3">
        <DataTable
          columns={[
            { key: 'timestamp', header: 'Timestamp', mobileHidden: true, render: (log: any) => <span className="text-[var(--text-muted)] text-[10px] font-mono">{new Date(log.timestamp).toLocaleString()}</span> },
            { key: 'actor', header: 'Actor', mobileHidden: true, render: (log: any) => <span className="text-[var(--warning)] text-[10px] font-mono">{log.actor_id?.slice(0, 10)}</span> },
            { key: 'role', header: 'Role', render: (log: any) => <span className="bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded text-[10px] text-[var(--gogrow-blue)]">{log.actor_role}</span> },
            { key: 'action', header: 'Action', mobilePrimary: true, render: (log: any) => <span className="font-bold text-[var(--text-main)]">{log.action}</span> },
            { key: 'resource', header: 'Resource', render: (log: any) => <span className="text-[var(--text-muted)]">{log.resource_type}</span> },
            { key: 'resourceId', header: 'Resource ID', mobileHidden: true, render: (log: any) => <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{log.resource_id?.slice(0, 10)}</span> },
            { key: 'ip', header: 'IP Address', mobileHidden: true, render: (log: any) => <span className="text-[var(--text-tertiary)] text-[10px] font-mono">{log.ip_address}</span> },
            { key: 'data', header: 'Data', mobileHidden: true, render: (log: any) => <span className="text-[10px] text-[var(--text-tertiary)] font-mono max-w-[120px] truncate block">{log.new_data ? JSON.stringify(log.new_data) : '—'}</span> },
          ]}
          rows={filtered}
          rowKey={(log: any) => log.id}
          emptyIcon={<FileText className="w-6 h-6" />}
          emptyTitle="No audit log entries"
          emptyMessage="No audit trail entries match the current filter."
        />
      </div>
    </div>
  );
};
