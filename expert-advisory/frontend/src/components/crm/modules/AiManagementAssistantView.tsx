"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Brain,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";

const PROMPT_PRESETS = [
  "How many leads did we receive yesterday?",
  "Which agent has the highest conversion rate?",
  "Which campaign generated the most revenue?",
  "Which subscriptions expire this week?",
  "Which customers are at risk of churn?",
  "What is our current sales pipeline?",
  "Which lead sources have the highest ROI?",
  "How much revenue is expected this month?",
];

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  metaData?: {
    metric?: string;
    details?: string[];
  };
}

export function AiManagementAssistantView() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "ai",
      text: "Hello Executive Team! I am your ExpertStocks Management AI Copilot. Ask me any question regarding your sales pipeline, CAC, agent performance, or upcoming subscription renewals.",
    },
  ]);

  const handleAsk = (textToAsk: string) => {
    const userText = textToAsk.trim();
    if (!userText) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, sender: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");

    setTimeout(() => {
      let aiResponseText = "";
      let metaDetails: string[] | undefined;

      const lower = userText.toLowerCase();
      if (lower.includes("yesterday") || lower.includes("how many leads")) {
        aiResponseText = "We ingested 18 verified leads yesterday (October 7, 2026). Google Ads contributed 44% (8 leads), Meta Instagram ads contributed 33% (6 leads), and Direct/Referrals accounted for 22% (4 leads).";
        metaDetails = ["Qualified Rate: 61.1%", "Average Declared Capital: ₹12.5 Lakhs", "Telecaller Contact Rate: 88.8%"];
      } else if (lower.includes("agent") || lower.includes("conversion rate")) {
        aiResponseText = "Sunita Verma holds the highest conversion rate at 31.8% with ₹14.50 Lakhs MTD revenue, specializing in HNI bespoke clients. Priya Sharma follows closely with 24.2% conversion rate and ₹8.90 Lakhs revenue.";
        metaDetails = ["1st: Sunita Verma (31.8% Win Rate)", "2nd: Priya Sharma (24.2% Win Rate)", "3rd: Vikram Malhotra (21.0% Win Rate)"];
      } else if (lower.includes("campaign") || lower.includes("revenue")) {
        aiResponseText = "The 'Nifty Options Alpha' Google campaign generated ₹18.5 Lakhs MTD with a 4.8x ROAS (Return on Ad Spend). 'HNI Wealth 2026' on Meta Instagram followed with ₹12.0 Lakhs revenue.";
        metaDetails = ["Google Search Ads: ₹18.5L (CAC ₹3,200)", "Meta Instagram: ₹12.0L (CAC ₹4,100)", "Partner Referrals: ₹7.5L (CAC ₹0)"];
      } else if (lower.includes("expire") || lower.includes("renew")) {
        aiResponseText = "We have 4 customer subscriptions expiring within the next 7 days, representing ₹1,15,000 in immediate renewal pipeline. Devendra Patel (Index Derivatives Alpha, ₹25K) is priority 1, expiring in 6 days.";
        metaDetails = ["Devendra Patel: 6 Days Remaining (Index Alpha)", "Kailash Chandani: 14 Days Remaining", "Automated WhatsApp 7d Notices Dispatched"];
      } else {
        aiResponseText = `Based on our current CRM database, active pipeline value is ₹1.45 Crore across 142 leads. Monthly revenue run rate stands at ₹42.50 Lakhs, representing 106% of monthly quota.`;
        metaDetails = ["Pipeline Win Probability: 23.4%", "Average Ticket Size: ₹35,200", "0 Grievance Escalations"];
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiResponseText,
        metaData: { details: metaDetails },
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Ask ExpertStocks AI (Executive Intelligence)
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand-400" />
              <span>NATURAL LANGUAGE QUERY COPILOT</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Query CRM performance, conversion drops, campaign attribution, and forecasting using plain English.
          </p>
        </div>
      </div>

      {/* Preset Prompts Row */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs py-1">
        <span className="text-[11px] font-mono text-ink-400 shrink-0">Sample Queries:</span>
        {PROMPT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleAsk(p)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] hover:bg-[#162235] text-ink-300 hover:text-white px-3 py-1.5 text-xs whitespace-nowrap transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Window */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] flex flex-col min-h-[520px] shadow-2xl overflow-hidden">
        {/* Chat Messages */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                "flex gap-3 max-w-2xl",
                m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cx(
                "size-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs shadow-md",
                m.sender === "user" ? "bg-brand-600 text-white" : "bg-gradient-to-tr from-brand-500 to-indigo-600 text-white"
              )}>
                {m.sender === "user" ? "U" : <Sparkles className="size-4" />}
              </div>

              <div className={cx(
                "rounded-2xl p-4 text-xs leading-relaxed shadow-sm space-y-2",
                m.sender === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-[#0E1624] text-ink-200 border border-[#1E293B]"
              )}>
                <p>{m.text}</p>

                {m.metaData?.details && (
                  <div className="rounded-xl bg-[#090E17] p-3 border border-[#1E293B] space-y-1 font-mono text-[11px]">
                    <span className="text-brand-400 uppercase font-bold block mb-1">
                      Data Verification Highlights:
                    </span>
                    {m.metaData.details.map((d, i) => (
                      <div key={i} className="text-emerald-300">
                        • {d}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#1E293B] bg-[#0B121E]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about leads, sales velocity, expiring subscriptions, CAC..."
              className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-3 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-3 text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-2"
            >
              <Send className="size-4" />
              <span>Ask AI</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
