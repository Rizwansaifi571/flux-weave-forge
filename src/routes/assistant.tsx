import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion } from "framer-motion";
import { Send, Sparkles, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/assistant")({ component: AssistantPage });

interface Msg { role: "user" | "ai"; text: string }

function AssistantPage() {
  const { tasks, habits, focusSessions, streakCount } = useStore();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "I'm your productivity copilot. I see your tasks, habits, and focus patterns. Ask me anything — or let me suggest your next move." },
  ]);
  const [input, setInput] = useState("");

  const today = todayStr();
  const pending = tasks.filter((t) => !t.completed);
  const overdue = pending.filter((t) => t.dueDate && t.dueDate < today);
  const focusToday = focusSessions.find((f) => f.date === today)?.minutes ?? 0;
  const habitMiss = habits.filter((h) => !h.history[today]);

  const insights = [
    { icon: Target, color: "text-neon-purple", title: "Priority focus", text: pending.find(t => t.priority === "high")?.title ? `Start with "${pending.find(t => t.priority === "high")?.title}" — it has the highest leverage.` : "No high-priority items. Set one now." },
    { icon: AlertTriangle, color: "text-neon-pink", title: "Overload check", text: overdue.length > 0 ? `You have ${overdue.length} overdue task(s). Reschedule or drop them.` : "No overdue items. You're current." },
    { icon: TrendingUp, color: "text-neon-cyan", title: "Focus rhythm", text: focusToday < 60 ? `Only ${focusToday}m of focus today. Aim for one 50-min block now.` : `${focusToday}m focused today. Solid pace — protect your evening.` },
    { icon: Sparkles, color: "text-neon-blue", title: "Habits", text: habitMiss.length ? `${habitMiss.length} habit(s) untouched today: ${habitMiss.map(h => h.emoji).join(" ")}` : "All habits checked. Keep the chain alive." },
  ];

  const generate = (q: string): string => {
    const lower = q.toLowerCase();
    if (lower.includes("priorit")) return `Your top priority right now: "${pending.find(t => t.priority === "high")?.title ?? "set a high-priority task"}". Block 50 minutes. No tabs, no Slack.`;
    if (lower.includes("overload") || lower.includes("too much")) return `You have ${pending.length} open tasks and a ${streakCount}-day streak. If it feels heavy, cut to 3 must-do items today.`;
    if (lower.includes("focus")) return `Today: ${focusToday}m focused. Push to 120m. Start a Pomodoro now from the Focus tab.`;
    if (lower.includes("habit")) return habitMiss.length ? `Missing: ${habitMiss.map(h => h.name).join(", ")}. Do the easiest one in the next 5 minutes.` : "All habits done. Don't break the chain tomorrow.";
    return `Based on your data: focus on shipping "${pending[0]?.title ?? "your next task"}". You're on a ${streakCount}-day streak — momentum compounds.`;
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTimeout(() => setMessages((m) => [...m, { role: "ai", text: generate(q) }]), 600);
  };

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader title="AI Assistant" subtitle="Predictive, opinionated, and tuned to your productivity data." />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <GlassCard className="flex flex-col !p-0 h-[600px]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "bg-gradient-primary text-white glow-soft" : "glass-strong"
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </div>
            <form onSubmit={send} className="border-t border-white/5 p-4 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about priorities, focus, or burnout..."
                className="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none"
              />
              <button className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center glow-soft hover:scale-105 transition">
                <Send className="h-4 w-4 text-white" />
              </button>
            </form>
          </GlassCard>

          <div className="space-y-3">
            {insights.map((ins, i) => (
              <motion.div
                key={ins.title}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <ins.icon className={`h-4 w-4 ${ins.color}`} />
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{ins.title}</div>
                </div>
                <p className="text-sm leading-relaxed">{ins.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}