import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useStore, motivationalQuotes, todayStr } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { PageHeader } from "@/components/PageHeader";
import { WallpaperPreview } from "@/components/WallpaperPreview";
import { CheckCircle2, Clock, Flame, ListTodo, Sparkles, TrendingUp, Trophy, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { tasks, habits, focusSessions, xp, userName = "Explorer" } = useStore();
  const today = todayStr();

  // ========== 1. FIXED: Compute streak from actual activity ==========
  const streak = useMemo(() => {
    // Collect all dates where user was active
    const activeDates = new Set<string>();

    // Tasks: if a task was completed and its dueDate is present
    tasks.forEach((task) => {
      if (task.completed && task.dueDate) {
        activeDates.add(task.dueDate);
      }
    });

    // Habits: any date where a habit was checked
    habits.forEach((habit) => {
      Object.keys(habit.history).forEach((date) => {
        if (habit.history[date]) activeDates.add(date);
      });
    });

    // Focus sessions: any date with minutes > 0
    focusSessions.forEach((session) => {
      if (session.minutes > 0) activeDates.add(session.date);
    });

    // Convert to array of dates sorted descending (most recent first)
    const sortedDates = Array.from(activeDates).sort().reverse();
    if (sortedDates.length === 0) return 0;

    let streakLength = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check consecutive days backwards from today
    for (let i = 0; i < 365; i++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      if (activeDates.has(dateStr)) {
        streakLength++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streakLength;
  }, [tasks, habits, focusSessions]);

  // ========== 2. FIXED: Focus today (sum all sessions) ==========
  const focusToday = useMemo(() => {
    return focusSessions
      .filter((session) => session.date === today)
      .reduce((sum, session) => sum + session.minutes, 0);
  }, [focusSessions, today]);

  // ========== 3. FIXED: Chart data – last 7 days, sorted ==========
  const chartData = useMemo(() => {
    // Create array of last 7 days (including today)
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().slice(0, 10));
    }

    // Map each day to focus minutes (sum if multiple sessions)
    return last7Days.map((date) => {
      const totalFocus = focusSessions
        .filter((s) => s.date === date)
        .reduce((sum, s) => sum + s.minutes, 0);
      return {
        day: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
        focus: totalFocus,
      };
    });
  }, [focusSessions]);

  // ========== Other derived stats (unchanged but memoized) ==========
  const todaysTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today),
    [tasks, today]
  );
  const completedToday = useMemo(
    () => todaysTasks.filter((t) => t.completed).length,
    [todaysTasks]
  );
  const pending = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );
  const completionPct = useMemo(
    () => (todaysTasks.length ? Math.round((completedToday / todaysTasks.length) * 100) : 0),
    [todaysTasks, completedToday]
  );
  const habitsDone = useMemo(
    () => habits.filter((h) => h.history[today]).length,
    [habits, today]
  );
  const totalHabits = habits.length;
  const habitsScore = totalHabits === 0 ? 0 : (habitsDone / totalHabits) * 100;

  const productivityScore = useMemo(() => {
    const focusRatio = Math.min(1, focusToday / 240);
    return Math.min(
      100,
      Math.round(completionPct * 0.4 + focusRatio * 100 * 0.4 + habitsScore * 0.2)
    );
  }, [completionPct, focusToday, habitsScore]);

  // ========== Greeting, time, quote (unchanged) ==========
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const [quote, setQuote] = useState("");
  useEffect(() => {
    const updateQuote = () => {
      const dayIndex = new Date().getDay();
      setQuote(motivationalQuotes[dayIndex % motivationalQuotes.length]);
    };
    updateQuote();
    const interval = setInterval(() => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      setTimeout(updateQuote, msUntilMidnight);
    }, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header with productivity ring */}
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold tracking-tight"
            >
              {greeting}, <span className="text-gradient">{userName}</span>
            </motion.h1>
            <p className="text-sm text-muted-foreground italic mt-2">"{quote}"</p>
          </div>
          <GlassCard className="p-5 min-w-[220px]">
            <div className="flex items-center gap-4">
              <div className="relative grid place-items-center w-16 h-16">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="oklch(1 0 0 / 0.08)" strokeWidth="8" fill="none" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="url(#productivityGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 264" }}
                    animate={{ strokeDasharray: `${(productivityScore / 100) * 264} 264` }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                  />
                </svg>
                <div className="text-lg font-bold">{productivityScore}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Productivity
                </div>
                <div className="text-sm font-medium">
                  {productivityScore >= 80
                    ? "Elite mode"
                    : productivityScore >= 50
                    ? "On track"
                    : "Push harder"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Stat Cards – streak now uses corrected `streak` variable */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={CheckCircle2} label="Completed today" value={completedToday} accent="from-neon-purple to-neon-pink" delay={0} />
          <StatCard icon={ListTodo} label="Pending" value={pending} accent="from-neon-blue to-neon-cyan" delay={0.05} />
          <StatCard icon={Flame} label="Streak" value={streak} suffix="days" accent="from-neon-pink to-neon-purple" delay={0.1} />
          <StatCard icon={Clock} label="Focus today" value={focusToday} suffix="min" accent="from-neon-cyan to-neon-blue" delay={0.15} />
        </div>

        {/* Charts and Wallpaper */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Weekly Focus
                </div>
                <h3 className="text-lg font-semibold mt-1">Deep work analytics</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neon-cyan">
                <TrendingUp className="h-3.5 w-3.5" />
                +18% vs last week
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.7 0.24 305)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="oklch(0.7 0.24 305)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.18 0.03 270 / 0.95)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                      backdropFilter: "blur(20px)",
                    }}
                  />
                  <Area type="monotone" dataKey="focus" stroke="oklch(0.7 0.24 305)" strokeWidth={2.5} fill="url(#focusGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Live wallpaper</div>
                <h3 className="text-lg font-semibold mt-1">Your screen</h3>
              </div>
              <Link to="/wallpaper" className="text-xs text-neon-cyan hover:text-neon-purple transition">
                Customize →
              </Link>
            </div>
            <div className="scale-95">
              <WallpaperPreview scale={0.6} />
            </div>
          </GlassCard>
        </div>

        {/* Tasks / Habits / AI Insight panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Today's tasks</h3>
              <Link to="/tasks" className="text-xs text-neon-cyan">All →</Link>
            </div>
            <div className="space-y-2">
              {todaysTasks.slice(0, 5).map((task) => (
                <motion.div key={task.id} whileHover={{ x: 4 }} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      task.completed
                        ? "bg-neon-cyan"
                        : task.priority === "high"
                        ? "bg-neon-pink"
                        : "bg-neon-purple"
                    }`}
                  />
                  <span className={`text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">{task.priority}</span>
                </motion.div>
              ))}
              {todaysTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No tasks due today. Add a mission.</p>
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Habits today</h3>
              <Link to="/habits" className="text-xs text-neon-cyan">View →</Link>
            </div>
            <div className="space-y-2">
              {habits.map((habit) => (
                <div key={habit.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <span className="text-lg">{habit.emoji}</span>
                  <span className="text-sm flex-1">{habit.name}</span>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      habit.history[today] ? "bg-neon-cyan glow-soft" : "bg-white/10"
                    }`}
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="relative">
            <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-neon-purple" />
                <h3 className="text-lg font-semibold">AI Insight</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You're {productivityScore >= 70 ? "ahead of pace" : "behind pace"} today. Focus on your{" "}
                <span className="text-foreground font-medium">
                  {tasks.find((t) => !t.completed && t.priority === "high")?.title ??
                    "highest-priority task"}
                </span>{" "}
                for the next 90 minutes. Skip context switches.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="glass rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-neon-pink" />
                    <span className="text-muted-foreground">XP</span>
                  </div>
                  <div className="text-base font-semibold mt-0.5">{xp}</div>
                </div>
                <div className="glass rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-neon-cyan" />
                    <span className="text-muted-foreground">Score</span>
                  </div>
                  <div className="text-base font-semibold mt-0.5">{productivityScore}/100</div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Global gradient */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="productivityGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.24 305)" />
            <stop offset="100%" stopColor="oklch(0.85 0.16 195)" />
          </linearGradient>
        </defs>
      </svg>
    </AppShell>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  accent: string;
  delay: number;
}

function StatCard({ icon: Icon, label, value, suffix, accent, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="glass rounded-2xl p-5 relative overflow-hidden group cursor-default"
    >
      <div
        className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`}
      />
      <Icon className="h-5 w-5 text-muted-foreground mb-3" />
      <div className="text-3xl font-semibold tracking-tight">
        {value}
        {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}