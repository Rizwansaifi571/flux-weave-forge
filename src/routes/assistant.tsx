import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion } from "framer-motion";
import { Send, Sparkles, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { askAssistant } from "@/lib/api/assistant.functions";
import type { AiContext } from "@/lib/ai/ai-types";
import { applyAiActions } from "@/lib/ai/task-actions";
import { importYouTubePlaylist } from "@/lib/api/youtube.functions";

export const Route = createFileRoute("/assistant")({ component: AssistantPage });

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
    assistantMessages,
    addAssistantMessage,
    playlistImports,
    addPlaylistImport,
  } = useStore();
  const [input, setInput] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [playlistItems, setPlaylistItems] = useState<{ title: string; durationMinutes: number | null }[]>([]);
  const [playlistDays, setPlaylistDays] = useState(10);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const totalPlaylistMinutes = useMemo(() => {
    return playlistItems.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  }, [playlistItems]);

  const buildContext = (): AiContext => ({
    userName,
    today,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      priority: t.priority,
      category: t.category,
      focusMinutes: t.focusMinutes,
      tags: t.tags,
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
    recentMessages: assistantMessages.slice(-12).map((m) => ({
      role: m.role,
      text: m.text,
    })),
    playlistImports: playlistImports.map((playlist) => ({
      id: playlist.id,
      title: playlist.title,
      items: playlist.items,
    })),
  });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input;
    addAssistantMessage({ role: "user", text: q });
    setInput("");
    try {
      const res = await askAssistant({ data: { message: q, context: buildContext() } });
      if (res.actions?.length) {
        applyAiActions(res.actions, {
          addTask,
          updateTask,
          deleteTask,
          addGoal,
          updateLifeContext,
        });
      }
      addAssistantMessage({ role: "ai", text: res.response });
    } catch (error) {
      console.error("Error calling AI assistant:", error);
      const message = error instanceof Error
        ? error.message
        : "Sorry, I had an issue. Please try again.";
      addAssistantMessage({ role: "ai", text: message });
    }
  };

  const handleImportPlaylist = async () => {
    if (!playlistUrl.trim()) return;
    setIsImporting(true);
    setPlaylistError(null);
    try {
      const res = await importYouTubePlaylist({ data: { url: playlistUrl.trim() } });
      setPlaylistTitle(res.title);
      setGoalTitle(res.title);
      setPlaylistItems(res.items.map((item) => ({
        title: item.title,
        durationMinutes: item.durationMinutes,
      })));
      addPlaylistImport({
        title: res.title,
        items: res.items.map((item, index) => ({
          index: index + 1,
          title: item.title,
          durationMinutes: item.durationMinutes,
        })),
      });
      const preview = res.items.slice(0, 8).map((item, index) => {
        const duration = item.durationMinutes != null ? ` (${item.durationMinutes}m)` : "";
        return `${index + 1}. ${item.title}${duration}`;
      }).join("\n");
      addAssistantMessage({
        role: "ai",
        text: `Playlist imported: "${res.title}" with ${res.items.length} videos.\nPreview:\n${preview}\nYou can now say: "continue from lecture 62" or ask for a roadmap.`,
      });
    } catch (error) {
      console.error("Error importing playlist:", error);
      const message = error instanceof Error
        ? error.message
        : "Unable to import playlist. Check the URL and API key.";
      setPlaylistError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!playlistItems.length) return;
    setIsGenerating(true);
    const name = goalTitle.trim() || playlistTitle || "Playlist";
    const itemsText = playlistItems
      .map((item, index) => {
        const duration = item.durationMinutes != null ? ` (${item.durationMinutes}m)` : "";
        return `${index + 1}. ${item.title}${duration}`;
      })
      .join("\n");

    const prompt = [
      `Create a ${playlistDays}-day roadmap for the playlist "${name}".`,
      "Create a goal and a daily task breakdown that finishes everything on time.",
      "Use create_goal for the roadmap and create_task for each day.",
      "Playlist items:",
      itemsText,
    ].join("\n");

    addAssistantMessage({ role: "user", text: prompt });
    try {
      const res = await askAssistant({ data: { message: prompt, context: buildContext() } });
      if (res.actions?.length) {
        applyActions(res.actions);
      }
      addAssistantMessage({ role: "ai", text: res.response });
    } catch (error) {
      console.error("Error generating roadmap:", error);
      addAssistantMessage({ role: "ai", text: "Sorry, I could not generate the roadmap." });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader title="AI Assistant" subtitle="Predictive, opinionated, and tuned to your productivity data." />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <GlassCard className="flex flex-col !p-0 h-[600px]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {assistantMessages.map((m, i) => (
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
            <GlassCard className="p-4 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Playlist Import</div>
                <div className="text-lg font-semibold">YouTube Roadmap Builder</div>
              </div>
              <input
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="Paste YouTube playlist URL"
                className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none"
              />
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <input
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Goal title"
                  className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none"
                />
                <input
                  type="number"
                  min={1}
                  value={playlistDays}
                  onChange={(e) => setPlaylistDays(Number(e.target.value))}
                  className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none"
                  aria-label="Target days"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleImportPlaylist}
                  className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition"
                >
                  {isImporting ? "Importing..." : "Import playlist"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateRoadmap}
                  className="flex-1 rounded-xl bg-gradient-primary px-4 py-2 text-sm text-white glow-soft hover:scale-[1.02] transition"
                >
                  {isGenerating ? "Generating..." : "Generate roadmap"}
                </button>
              </div>
              {playlistError ? (
                <div className="text-xs text-red-300">{playlistError}</div>
              ) : null}
              {playlistItems.length ? (
                <div className="text-xs text-muted-foreground">
                  {playlistItems.length} videos • {totalPlaylistMinutes} min total
                </div>
              ) : null}
            </GlassCard>
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
