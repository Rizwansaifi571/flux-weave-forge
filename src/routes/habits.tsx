import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Plus, Flame } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/habits")({ component: HabitsPage });

const COLORS = ["neon-purple", "neon-blue", "neon-cyan", "neon-pink"];
const EMOJIS = ["💪", "📚", "🧘", "🚿", "🥗", "💧", "✍️", "🎯", "🎨", "💻"];

function HabitsPage() {
  const { habits, toggleHabit, addHabit, deleteHabit } = useStore();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");

  const days = Array.from({ length: 49 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (48 - i));
    return d.toISOString().slice(0, 10);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addHabit({ name, emoji, color: COLORS[habits.length % COLORS.length] });
    setName("");
  };

  const streakFor = (h: typeof habits[number]) => {
    let count = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (h.history[days[i]]) count++;
      else break;
    }
    return count;
  };

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader title="Habits" subtitle="Chains, not perfection. Don't break the streak." />

        <GlassCard className="mb-6">
          <form onSubmit={submit} className="flex gap-2 items-center flex-wrap">
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="glass rounded-lg px-3 py-2 text-lg outline-none">
              {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New habit..." className="flex-1 min-w-[200px] bg-transparent outline-none text-sm" />
            <button className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-medium text-white flex items-center gap-1.5 glow-soft">
              <Plus className="h-3 w-3" /> Add Habit
            </button>
          </form>
        </GlassCard>

        <div className="space-y-4">
          {habits.map((h) => {
            const streak = streakFor(h);
            const completed = days.filter((d) => h.history[d]).length;
            return (
              <GlassCard key={h.id} className="!p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl grid place-items-center text-xl glass-strong glow-soft`}>{h.emoji}</div>
                    <div>
                      <div className="font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">{completed} of last {days.length} days</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Flame className="h-4 w-4 text-neon-pink" />
                      <span className="font-semibold">{streak}</span>
                      <span className="text-xs text-muted-foreground">day streak</span>
                    </div>
                    <button onClick={() => deleteHabit(h.id)} className="text-xs text-muted-foreground hover:text-neon-pink">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(49,minmax(0,1fr))] gap-1">
                  {days.map((d) => {
                    const done = h.history[d];
                    return (
                      <motion.button
                        key={d}
                        whileHover={{ scale: 1.4 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleHabit(h.id, d)}
                        title={d}
                        className={`aspect-square rounded-[3px] transition ${done ? `bg-${h.color} glow-soft` : "bg-white/5 hover:bg-white/10"}`}
                        style={done ? {
                          background: h.color === "neon-purple" ? "oklch(0.7 0.24 305)" :
                                       h.color === "neon-blue" ? "oklch(0.72 0.2 250)" :
                                       h.color === "neon-cyan" ? "oklch(0.85 0.16 195)" :
                                       "oklch(0.72 0.24 350)"
                        } : undefined}
                      />
                    );
                  })}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}