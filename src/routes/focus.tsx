import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Coffee, Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/focus")({ component: FocusPage });

const MODES = {
  focus: { label: "Deep Focus", minutes: 50, icon: Brain },
  pomodoro: { label: "Pomodoro", minutes: 25, icon: Brain },
  break: { label: "Break", minutes: 5, icon: Coffee },
} as const;

function FocusPage() {
  const { tasks, logFocus } = useStore();
  const [mode, setMode] = useState<keyof typeof MODES>("focus");
  const [remaining, setRemaining] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const total = MODES[mode].minutes * 60;
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setRemaining(MODES[mode].minutes * 60); setRunning(false); }, [mode]);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            if (mode !== "break") logFocus(MODES[mode].minutes);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, mode, logFocus]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pct = ((total - remaining) / total) * 100;

  const priorities = tasks.filter((t) => !t.completed && t.priority === "high").slice(0, 3);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader title="Focus Mode" subtitle="Lock in. Distraction-free deep work." />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2 grid place-items-center py-12">
            <div className="flex gap-2 mb-8">
              {Object.entries(MODES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setMode(k as keyof typeof MODES)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition ${mode === k ? "bg-gradient-primary text-white glow-soft" : "glass text-muted-foreground"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="relative grid place-items-center w-[340px] h-[340px]">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" stroke="oklch(1 0 0 / 0.06)" strokeWidth="2" fill="none" />
                <motion.circle
                  cx="50" cy="50" r="46" stroke="url(#timerGrad)" strokeWidth="2" fill="none" strokeLinecap="round"
                  animate={{ strokeDasharray: `${(pct / 100) * 289} 289` }}
                  transition={{ duration: 0.5 }}
                  style={{ filter: "drop-shadow(0 0 8px oklch(0.7 0.24 305 / 0.6))" }}
                />
                <defs>
                  <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.24 305)" />
                    <stop offset="50%" stopColor="oklch(0.72 0.2 250)" />
                    <stop offset="100%" stopColor="oklch(0.85 0.16 195)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="text-center">
                <div className="text-7xl font-bold tracking-tighter tabular-nums">
                  {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
                </div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">{MODES[mode].label}</div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setRunning((r) => !r)}
                className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center glow-primary hover:scale-105 transition"
              >
                {running ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
              </button>
              <button
                onClick={() => { setRunning(false); setRemaining(MODES[mode].minutes * 60); }}
                className="h-14 w-14 rounded-full glass grid place-items-center hover:bg-white/10 transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Top Priorities</h3>
              <div className="space-y-2">
                {priorities.length === 0 && <p className="text-sm text-muted-foreground">No high-priority tasks.</p>}
                {priorities.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg glass-strong">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-neon-pink animate-pulse-glow" />
                      <div className="text-sm font-medium">{t.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t.focusMinutes}m estimated</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Session</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {running ? "You're in the zone. No tabs, no notifications, no excuses." : "Hit play to enter deep work. Your wallpaper will reflect every minute focused."}
              </p>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}