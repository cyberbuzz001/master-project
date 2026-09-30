import React, { useState, useEffect } from 'react';
import { 
  Headset, MessageSquare, AlertTriangle, CheckCircle2, Clock, 
  Search, Filter, User, Mail, Phone, ExternalLink, RefreshCw, 
  Send, X, Check, ArrowRight, ShieldAlert, Sparkles, Building2, AlertCircle
} from 'lucide-react';

interface SupportTicketsAdminProps {
  token: string;
}

export const SupportTicketsAdmin: React.FC<SupportTicketsAdminProps> = ({ token }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    urgent: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Ticket Response / Inspection Modal
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTickets = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (priorityFilter) params.append('priority', priorityFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (searchQuery) params.append('search', searchQuery);

    fetch(`/api/v1/admin/support/tickets?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTickets(d.tickets || []);
          if (d.stats) setStats(d.stats);
          if (selectedTicket) {
            const updated = (d.tickets || []).find((t: any) => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, [token, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingStatus(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, adminNotes: adminNotesInput })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchTickets();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to update status' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdatePriority = async (ticketId: string, newPriority: string) => {
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${ticketId}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priority: newPriority })
      });
      const data = await res.json();
      if (data.success) {
        fetchTickets();
      }
    } catch (_) {}
  };

  const priorityColors: Record<string, string> = {
    URGENT: 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse font-black',
    HIGH: 'bg-orange-950 text-orange-300 border-orange-800 font-bold',
    MEDIUM: 'bg-amber-950 text-amber-300 border-amber-800 font-semibold',
    LOW: 'bg-slate-800 text-slate-400 border-slate-700 font-medium',
  };

  const statusColors: Record<string, string> = {
    OPEN: 'bg-amber-950/90 text-amber-300 border-amber-800',
    IN_PROGRESS: 'bg-blue-950/90 text-blue-300 border-blue-800',
    RESOLVED: 'bg-emerald-950/90 text-emerald-300 border-emerald-800',
    CLOSED: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      
      {/* 1. Header & Live Support Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl shadow">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Tickets</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.total}</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'OPEN' ? '' : 'OPEN')}
          className={`p-3 rounded-xl border cursor-pointer transition shadow ${
            statusFilter === 'OPEN' ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900/80 border-slate-800 hover:border-amber-700/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-400">Open Tickets</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </div>
          <span className="text-xl font-extrabold text-amber-300 font-mono mt-1 block">{stats.open}</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? '' : 'IN_PROGRESS')}
          className={`p-3 rounded-xl border cursor-pointer transition shadow ${
            statusFilter === 'IN_PROGRESS' ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900/80 border-slate-800 hover:border-blue-700/50'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-blue-400 block mb-1">In Progress</span>
          <span className="text-xl font-extrabold text-blue-300 font-mono">{stats.inProgress}</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? '' : 'RESOLVED')}
          className={`p-3 rounded-xl border cursor-pointer transition shadow ${
            statusFilter === 'RESOLVED' ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-900/80 border-slate-800 hover:border-emerald-700/50'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Resolved</span>
          <span className="text-xl font-extrabold text-emerald-300 font-mono">{stats.resolved}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-rose-400">Urgent Pending</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <span className="text-xl font-extrabold text-rose-400 font-mono mt-1 block">{stats.urgent}</span>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3.5 border border-slate-800 rounded-xl shadow">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user, subject, ticket ID..."
              className="w-64 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-medium outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open ({stats.open})</option>
            <option value="IN_PROGRESS">In Progress ({stats.inProgress})</option>
            <option value="RESOLVED">Resolved ({stats.resolved})</option>
            <option value="CLOSED">Closed ({stats.closed})</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="">All Categories</option>
            <option value="TRADING">Trading & Orders</option>
            <option value="KYC">KYC & Verification</option>
            <option value="FUNDS">Funds & Deposits/Withdrawals</option>
            <option value="ACCOUNT">Account & Profile</option>
            <option value="TECHNICAL">Technical & App Bugs</option>
            <option value="OTHER">Other Inquiries</option>
          </select>
        </div>

        <button
          onClick={fetchTickets}
          className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3. Main Support Tickets Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex-1 overflow-y-auto shadow-inner">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 font-extrabold border-b border-slate-800 z-10">
            <tr>
              <th className="py-3 px-3.5">Ticket ID & User</th>
              <th className="py-3 px-3.5">Category</th>
              <th className="py-3 px-3.5">Priority</th>
              <th className="py-3 px-3.5">Subject & Description</th>
              <th className="py-3 px-3.5">Status</th>
              <th className="py-3 px-3.5">Created At</th>
              <th className="py-3 px-3.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {tickets.map(t => (
              <tr key={t.id} className="hover:bg-slate-800/40 transition-colors group">
                {/* ID & User */}
                <td className="py-3 px-3.5">
                  <div className="font-mono text-amber-400 font-bold text-[11px]">{t.id.slice(0, 12)}</div>
                  <div className="font-extrabold text-white group-hover:text-amber-400 transition-colors">{t.username}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{t.email}</div>
                </td>

                {/* Category */}
                <td className="py-3 px-3.5">
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-bold">
                    {t.category}
                  </span>
                </td>

                {/* Priority */}
                <td className="py-3 px-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${priorityColors[t.priority] || 'bg-slate-800 text-slate-400'}`}>
                    {t.priority}
                  </span>
                </td>

                {/* Subject & Description */}
                <td className="py-3 px-3.5 max-w-[280px]">
                  <div className="font-bold text-white text-[12px] truncate">{t.subject}</div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</div>
                  {t.admin_notes && (
                    <div className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/50 mt-1 truncate">
                      <strong>Admin:</strong> {t.admin_notes}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-3.5">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${statusColors[t.status] || 'bg-slate-800 text-slate-400'}`}>
                    {t.status}
                  </span>
                </td>

                {/* Date */}
                <td className="py-3 px-3.5 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </td>

                {/* Actions */}
                <td className="py-3 px-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedTicket(t);
                        setAdminNotesInput(t.admin_notes || '');
                        setActionMsg(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Respond
                    </button>

                    {t.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                        className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Mark as In Progress"
                      >
                        <Clock className="w-3 h-3" /> Progress
                      </button>
                    )}

                    {t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'RESOLVED')}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Mark as Resolved"
                      >
                        <Check className="w-3 h-3" /> Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tickets.length === 0 && (
          <div className="text-center py-16 text-slate-500 font-bold">
            No support tickets found matching your filters.
          </div>
        )}
      </div>

      {/* 4. Ticket Response & Inspection Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Headset className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Customer Support Ticket Response</h3>
                  <p className="text-[11px] text-slate-400">Ticket ID: <span className="font-mono text-amber-400 font-bold">{selectedTicket.id}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Client Details Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Customer Name</span>
                <span className="text-white font-bold">{selectedTicket.username}</span>
                {selectedTicket.full_name && <span className="text-slate-500 block text-[10px]">({selectedTicket.full_name})</span>}
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Email Address</span>
                <span className="font-mono text-slate-300">{selectedTicket.email}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Phone Number</span>
                <span className="font-mono text-slate-300">{selectedTicket.phone_number || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Category</span>
                <span className="font-bold text-teal-400">{selectedTicket.category}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Priority Level</span>
                <select
                  value={selectedTicket.priority}
                  onChange={e => handleUpdatePriority(selectedTicket.id, e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-300 font-bold"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Submitted On</span>
                <span className="text-slate-400 font-mono text-[10px]">{new Date(selectedTicket.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Ticket Subject & Description Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Subject: {selectedTicket.subject}</span>
                </h4>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${statusColors[selectedTicket.status] || 'bg-slate-800'}`}>
                  {selectedTicket.status}
                </span>
              </div>
              <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            </div>

            {/* Admin Response / Notes Editor */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Admin Resolution Notes / Customer Reply
              </label>
              <textarea
                rows={3}
                value={adminNotesInput}
                onChange={e => setAdminNotesInput(e.target.value)}
                placeholder="Type resolution explanation or internal audit note..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            {actionMsg && (
              <div className={`p-3 rounded-xl font-bold flex items-center gap-2 text-xs ${
                actionMsg.type === 'success' ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}>
                {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{actionMsg.text}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')}
                  disabled={updatingStatus}
                  className="px-3 py-2 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 text-xs font-bold transition cursor-pointer"
                >
                  Mark In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                  disabled={updatingStatus}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark Resolved
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedTicket.id, 'CLOSED')}
                  disabled={updatingStatus}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Close Ticket
                </button>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
