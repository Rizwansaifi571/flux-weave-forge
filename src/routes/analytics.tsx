import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion } from "framer-motion";
import { BarChart3, Trophy, Timer, CheckSquare, Target, Zap, Shield, Flame, Activity, Star } from "lucide-react";
import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from "recharts";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const { tasks, habits, focusSessions, xp, level, streakCount } = useStore();
  const today = todayStr();

  // ========== 1. DYNAMIC METRICS ==========
  const totalFocusMinutes = useMemo(() => {
    return focusSessions.reduce((sum, s) => sum + s.minutes, 0);
  }, [focusSessions]);

  const totalCompletedTasks = useMemo(() => {
    return tasks.filter((t) => t.completed).length;
  }, [tasks]);

  const totalCompletedHabits = useMemo(() => {
    return habits.reduce((sum, h) => sum + Object.values(h.history).filter(Boolean).length, 0);
  }, [habits]);

  // ========== 2. WEEKLY FOCUS CHART DATA ==========
  const weeklyFocusData = useMemo(() => {
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().slice(0, 10));
    }
    return last7Days.map((date) => {
      const session = focusSessions.find((s) => s.date === date);
      return {
        day: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
        minutes: session ? session.minutes : 0,
      };
    });
  }, [focusSessions]);

  // ========== 3. DYNAMIC ACHIEVEMENTS / BADGES ==========
  const achievements = useMemo(() => {
    return [
      {
        id: "xp_1",
        title: "XP Initiate",
        description: "Earn 100 total experience points",
        icon: Zap,
        unlocked: xp >= 100,
        current: xp,
        target: 100,
        color: "from-purple-500 to-indigo-500",
        shadow: "rgba(168, 85, 247, 0.4)",
      },
      {
        id: "xp_2",
        title: "XP Titan",
        description: "Earn 1,000 total experience points",
        icon: Star,
        unlocked: xp >= 1000,
        current: xp,
        target: 1000,
        color: "from-amber-400 to-orange-500",
        shadow: "rgba(245, 158, 11, 0.4)",
      },
      {
        id: "streak_1",
        title: "Habitual",
        description: "Achieve a 3-day active streak",
        icon: Flame,
        unlocked: streakCount >= 3,
        current: streakCount,
        target: 3,
        color: "from-orange-500 to-red-500",
        shadow: "rgba(249, 115, 22, 0.4)",
      },
      {
        id: "streak_2",
        title: "Consistency God",
        description: "Achieve a 7-day active streak",
        icon: Shield,
        unlocked: streakCount >= 7,
        current: streakCount,
        target: 7,
        color: "from-red-500 to-pink-500",
        shadow: "rgba(239, 68, 68, 0.4)",
      },
      {
        id: "focus_1",
        title: "Deep Work Novice",
        description: "Log 60 minutes of deep focus timer sessions",
        icon: Timer,
        unlocked: totalFocusMinutes >= 60,
        current: totalFocusMinutes,
        target: 60,
        color: "from-cyan-400 to-blue-500",
        shadow: "rgba(6, 182, 212, 0.4)",
      },
      {
        id: "focus_2",
        title: "Flow State Master",
        description: "Log 300 minutes of deep focus timer sessions",
        icon: Trophy,
        unlocked: totalFocusMinutes >= 300,
        current: totalFocusMinutes,
        target: 300,
        color: "from-indigo-500 to-purple-600",
        shadow: "rgba(79, 70, 229, 0.4)",
      },
      {
        id: "tasks_1",
        title: "Task Crusher",
        description: "Complete 10 total productivity tasks",
        icon: CheckSquare,
        unlocked: totalCompletedTasks >= 10,
        current: totalCompletedTasks,
        target: 10,
        color: "from-emerald-400 to-teal-500",
        shadow: "rgba(16, 185, 129, 0.4)",
      },
      {
        id: "habits_1",
        title: "Atomic Habits",
        description: "Log 20 total habit check-ins",
        icon: Activity,
        unlocked: totalCompletedHabits >= 20,
        current: totalCompletedHabits,
        target: 20,
        color: "from-pink-500 to-rose-600",
        shadow: "rgba(236, 72, 153, 0.4)",
      },
    ];
  }, [xp, streakCount, totalFocusMinutes, totalCompletedTasks, totalCompletedHabits]);

  const unlockedCount = useMemo(() => achievements.filter((a) => a.unlocked).length, [achievements]);

  // ========== 4. AI COACH DIAGNOSTIC RECOMMENDATION ==========
  const diagnostics = useMemo(() => {
    if (totalCompletedTasks === 0 && totalCompletedHabits === 0) {
      return "Your dashboard is ready. Tackle your first task to start collecting XP and unlocking your performance badges.";
    }
    if (streakCount >= 5) {
      return "Elite consistency detected! You are protecting your daily rhythm beautifully. Consider increasing your deep work block by 15 minutes to test your focus limits.";
    }
    if (totalFocusMinutes > 180) {
      return "Strong focus duration! You are racking up valuable flow state minutes. Make sure you are prioritizing high-impact tasks during your peak energy hours.";
    }
    return "You are building momentum. Focus on completing at least one high-priority task today to sustain your streak.";
  }, [totalCompletedTasks, totalCompletedHabits, streakCount, totalFocusMinutes]);

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Performance & Analytics"
          subtitle="Visualize your focus trends, track deep work habits, and unlock SaaS milestones."
        />

        {/* Dynamic Achievements Summary Bar */}
        <GlassCard className="p-6 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20 border border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            <div className="space-y-1 text-center md:text-left">
              <h2 className="text-xl font-bold flex items-center justify-center md:justify-start gap-2">
                <Trophy className="h-5 w-5 text-yellow-400 animate-pulse" />
                Achievements Hub
              </h2>
              <p className="text-sm text-muted-foreground">
                You have unlocked {unlockedCount} of {achievements.length} operational achievements
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Hub Progress</span>
                <span className="text-2xl font-bold text-gradient">
                  {Math.round((unlockedCount / achievements.length) * 100)}%
                </span>
              </div>
              <div className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                <Trophy className="h-6 w-6 text-neon-cyan" />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Recharts Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Focus Minutes */}
          <GlassCard className="lg:col-span-2 p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Focus Rhythm Trend</h3>
              <p className="text-xs text-muted-foreground">Daily timer minutes logged over the last 7 days</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyFocusData}>
                  <defs>
                    <linearGradient id="analyticsFocusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                  <XAxis dataKey="day" stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.18 0.03 270 / 0.95)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                      backdropFilter: "blur(20px)",
                    }}
                    formatter={(value) => [`${value} min`, "Focus Time"]}
                  />
                  <Area type="monotone" dataKey="minutes" stroke="#c084fc" strokeWidth={2} fill="url(#analyticsFocusGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* AI Advisor Panel */}
          <GlassCard className="p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-neon-cyan" />
                <h3 className="text-base font-semibold">Deep Work Diagnosis</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                "{diagnostics}"
              </p>
            </div>
            <div className="mt-6 border-t border-white/5 pt-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Dynamic XP:</span>
                <span className="font-semibold text-neon-purple">{xp} XP</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Calculated Level:</span>
                <span className="font-semibold text-neon-cyan">Lvl {level}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current Streak:</span>
                <span className="font-semibold text-neon-pink">{streakCount} days</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Milestone Grid */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Milestones & Achievements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((ach) => {
              const Icon = ach.icon;
              const percent = Math.min(100, Math.round((ach.current / ach.target) * 100));

              return (
                <GlassCard
                  key={ach.id}
                  className={`p-5 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                    ach.unlocked
                      ? "border-white/10 bg-white/5"
                      : "opacity-60 saturate-50 border-white/5"
                  }`}
                  style={{
                    boxShadow: ach.unlocked
                      ? `0 10px 30px -10px ${ach.shadow}, inset 0 1px 0 rgba(255,255,255,0.05)`
                      : "none",
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${
                          ach.unlocked ? ach.color : "from-white/5 to-white/10"
                        } text-white shadow-md`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          ach.unlocked
                            ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/20 animate-pulse"
                            : "bg-white/5 text-muted-foreground border border-white/5"
                        }`}
                      >
                        {ach.unlocked ? "UNLOCKED" : "LOCKED"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm group-hover:text-neon-cyan transition-colors">
                        {ach.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {ach.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span>
                        {ach.current} / {ach.target}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${ach.color} rounded-full`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
