"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  PhoneCall,
  MessageSquare,
  Video,
  User,
  X,
  Filter,
  CalendarCheck,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmTask } from "@/lib/crm-data";

interface TasksAppointmentsViewProps {
  tasks: CrmTask[];
  onCompleteTask?: (taskId: string) => void;
  onAddTask?: (task: CrmTask) => void;
}

const CALENDAR_SLOTS = [
  "09:15 AM - Pre-Market Opening",
  "10:30 AM - Morning Consultation Slot",
  "12:00 PM - Risk Profile & KYC Verification",
  "02:00 PM - Mid-Day Strategy Discussion",
  "03:30 PM - Post-Market Review & Closing Call",
  "05:00 PM - Evening Advisory Onboarding",
];

export function TasksAppointmentsView({
  tasks,
  onCompleteTask,
  onAddTask,
}: TasksAppointmentsViewProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar">("tasks");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CrmTask["type"]>("CALL");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [owner, setOwner] = useState("Vikram Malhotra");
  const [priority, setPriority] = useState<CrmTask["priority"]>("HIGH");
  const [dueDate, setDueDate] = useState("Today, 03:30 PM");
  const [notes, setNotes] = useState("");

  const filteredTasks = tasks.filter((t) => filterType === "ALL" || t.type === filterType);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !customerName) return;

    const newTask: CrmTask = {
      id: `TSK-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      type,
      customerName,
      customerId: customerId || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      owner,
      priority,
      dueDate,
      status: "PENDING",
      notes: notes || undefined,
    };

    if (onAddTask) {
      onAddTask(newTask);
    }
    setShowAddModal(false);
    setTitle("");
    setCustomerName("");
    setCustomerId("");
    setNotes("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Tasks & Consultation Appointments Desk
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              {tasks.length} Active Items
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Automated telecaller follow-up schedules, advisor meetings, and client onboarding milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setActiveTab("tasks")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "tasks" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Tasks Queue
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "calendar" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Calendar Schedule
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-2 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Schedule Task</span>
          </button>
        </div>
      </div>

      {activeTab === "tasks" ? (
        /* Task Queue List */
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl space-y-0">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Pending Tasks Queue ({filteredTasks.length})
            </h2>
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {["ALL", "CALL", "WHATSAPP", "MEETING", "FOLLOWUP", "PAYMENT"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cx(
                    "px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer",
                    filterType === t ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white bg-[#0B121E]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#1E293B]/60">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#0E1624]/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cx(
                        "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase border",
                        task.priority === "URGENT"
                          ? "bg-red-500/15 border-red-500/30 text-red-300"
                          : task.priority === "HIGH"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      )}
                    >
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-mono text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                      {task.type}
                    </span>
                    <h3 className="font-bold text-sm text-white">{task.title}</h3>
                  </div>
                  <p className="text-xs text-ink-400">
                    Client: <strong className="text-white">{task.customerName}</strong> ({task.customerId}) • Owner: {task.owner}
                  </p>
                  {task.notes && (
                    <p className="text-[11px] text-ink-400 italic bg-[#0B121E] px-2 py-1 rounded inline-block">
                      &quot;{task.notes}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-xs">
                    <span className="text-ink-400 text-[10px] block">Due Time:</span>
                    <span className="text-amber-400 font-bold">{task.dueDate}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCompleteTask && onCompleteTask(task.id)}
                    className="rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 px-3 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Mark Done</span>
                  </button>
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div className="p-8 text-center text-xs text-ink-400">
                No tasks matching the selected filter.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Calendar Schedule View */
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-brand-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                Today&apos;s Consultation & Calling Schedule
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-400">All slots synchronized (IST)</span>
          </div>

          <div className="space-y-3">
            {CALENDAR_SLOTS.map((slot, index) => {
              const matchedTasks = tasks.filter((_, idx) => idx % CALENDAR_SLOTS.length === index);
              return (
                <div key={slot} className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-[#0E1624] border border-[#1E293B] flex items-center justify-center font-mono text-xs text-brand-300 font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white font-mono">{slot}</h4>
                      <p className="text-xs text-ink-400">
                        {matchedTasks.length > 0
                          ? `${matchedTasks.length} Scheduled Client Touchpoints`
                          : "Available for Inbound Callback or RPM Assessment"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedTasks.map((t) => (
                      <div key={t.id} className="rounded-lg bg-[#162235] px-3 py-1.5 text-xs border border-brand-500/20 text-white flex items-center gap-2">
                        <span className="font-semibold">{t.customerName}</span>
                        <span className="text-[10px] text-brand-300 font-mono">({t.type})</span>
                      </div>
                    ))}
                    {matchedTasks.length === 0 && (
                      <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                        Open Slot
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCHEDULE TASK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#0B121E] p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-brand-400" />
                <h3 className="font-bold text-lg font-display">Schedule Task or Appointment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:text-white bg-[#0E1624] border border-[#1E293B] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Risk Assessment & Strategy Discussion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Task Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="CALL">Outbound Phone Call</option>
                    <option value="MEETING">Video Consultation</option>
                    <option value="WHATSAPP">WhatsApp Follow-up</option>
                    <option value="FOLLOWUP">Callback</option>
                    <option value="KYC">KYC Document Collection</option>
                    <option value="PAYMENT">Payment Reminder</option>
                    <option value="RENEWAL">Renewal Discussion</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="URGENT">Urgent (Immediate SLA)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Harish Chandra Rao"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Due Date & Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="Today, 03:30 PM"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Owner / Assigned Advisor</label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  <option value="Vikram Malhotra">Vikram Malhotra</option>
                  <option value="Ananya Iyer">Ananya Iyer</option>
                  <option value="Rohit Sharma">Rohit Sharma</option>
                  <option value="Pooja Hegde">Pooja Hegde</option>
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Context, past objections, or specific advisory segment to review..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 font-bold text-ink-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2 font-bold text-white transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
