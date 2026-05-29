import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion } from "framer-motion";
import { Send, Sparkles, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { useState } from "react";
import { askAssistant } from "@/lib/api/assistant.functions";
import type { AiAction, AiContext } from "@/lib/ai/ai-types";

export const Route = createFileRoute("/assistant")({ component: AssistantPage });

interface Msg { role: "user" | "ai"; text: string }

function AssistantPage() {
  const {
    tasks,
    habits,
    goals,
    lifeContext,
    focusSessions,
    streakCount,
    userName,
    addTask,
    updateTask,
    deleteTask,
    addGoal,
    updateLifeContext,
  } = useStore();
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

  const buildContext = (): AiContext => ({
    userName,
    today,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      category: t.category,
      completed: t.completed,
    })),
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      doneToday: Boolean(h.history[today]),
    })),
    focusToday,
    streakCount,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      progress: g.progress,
      deadline: g.deadline,
      category: g.category,
      status: g.status,
    })),
    lifeContext: {
      collegeTimetable: lifeContext.collegeTimetable.map((c) => ({
        day: c.day,
        start: c.start,
        end: c.end,
        label: c.label,
      })),
      exams: lifeContext.exams.map((e) => ({
        title: e.title,
        date: e.date,
        course: e.course,
      })),
      internships: lifeContext.internships.map((i) => ({
        company: i.company,
        role: i.role,
        startDate: i.startDate,
        endDate: i.endDate,
        status: i.status,
      })),
      sleepSchedule: lifeContext.sleepSchedule,
      preferredStudyHours: lifeContext.preferredStudyHours,
      placementGoals: lifeContext.placementGoals,
    },
  });

  const applyActions = (actions: AiAction[]) => {
    actions.forEach((action) => {
      if (action.type === "create_task") {
        addTask({
          title: action.payload.title,
          description: action.payload.description,
          dueDate: action.payload.dueDate,
          priority: action.payload.priority ?? "medium",
          tags: action.payload.tags ?? [],
          focusMinutes: action.payload.focusMinutes ?? 0,
          category: action.payload.category ?? "Work",
        });
      }

      if (action.type === "update_task") {
        updateTask(action.payload.id, action.payload.patch);
      }

      if (action.type === "delete_task") {
        deleteTask(action.payload.id);
      }

      if (action.type === "create_goal") {
        addGoal({
          title: action.payload.title,
          description: action.payload.description ?? "",
          deadline: action.payload.deadline,
          category: action.payload.category ?? "career",
        });
      }

      if (action.type === "set_context") {
        updateLifeContext(action.payload);
      }
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    try {
      const res = await askAssistant({ data: { message: q, context: buildContext() } });
      if (res.actions?.length) {
        applyActions(res.actions);
      }
      setMessages((m) => [...m, { role: "ai", text: res.response }]);
    } catch (error) {
      console.error("Error calling AI assistant:", error);
      setMessages((m) => [...m, { role: "ai", text: "Sorry, I had an issue. Please try again." }]);
    }
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
              <button
                className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center glow-soft hover:scale-105 transition"
                aria-label="Send message"
              >
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