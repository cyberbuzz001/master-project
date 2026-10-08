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
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmTask } from "@/lib/crm-data";

interface TasksAppointmentsViewProps {
  tasks: CrmTask[];
  onCompleteTask?: (taskId: string) => void;
}

export function TasksAppointmentsView({ tasks, onCompleteTask }: TasksAppointmentsViewProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar">("tasks");

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

        <div className="flex items-center gap-2 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={cx(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "tasks" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Tasks Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={cx(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "calendar" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Calendar Schedule
          </button>
        </div>
      </div>

      {/* Task Queue List */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Pending Tasks ({tasks.length})
          </h2>
          <span className="text-[11px] font-mono text-ink-400">Synchronized with Agent Calendar</span>
        </div>

        <div className="divide-y divide-[#1E293B]/60">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#0E1624]/60 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className={cx(
                    "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase border",
                    task.priority === "URGENT" ? "bg-red-500/15 border-red-500/30 text-red-300" :
                    task.priority === "HIGH" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" :
                    "bg-blue-500/15 border-blue-500/30 text-blue-300"
                  )}>
                    {task.priority}
                  </span>
                  <h3 className="font-bold text-sm text-white">{task.title}</h3>
                </div>
                <p className="text-xs text-ink-400">
                  Client: <strong>{task.customerName}</strong> ({task.customerId}) • Owner: {task.owner}
                </p>
                {task.notes && <p className="text-[11px] text-ink-400 italic">&quot;{task.notes}&quot;</p>}
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
        </div>
      </div>
    </div>
  );
}
