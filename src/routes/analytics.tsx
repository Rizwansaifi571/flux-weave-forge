import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, todayStr } from "@/lib/store";
import { motion } from "framer-motion";
import { Trophy, Timer, CheckSquare, Target, Zap, Shield, Flame, Activity, Star, Award, Compass, Swords } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

// RPG Level Title Mapping
const LEVEL_TITLES = [
  "Initiate of the Flow",    // Lvl 1
  "Deep Work Apprentice",    // Lvl 2
  "Task Executioner",        // Lvl 3
  "Habit Conjurer",          // Lvl 4
  "Flow State Mage",         // Lvl 5
  "Consistency Paladin",     // Lvl 6
  "Productivity Overlord",   // Lvl 7+
];

const getLevelTitle = (lvl: number) => {
  if (lvl < 1) return LEVEL_TITLES[0];
  if (lvl > LEVEL_TITLES.length) return LEVEL_TITLES[LEVEL_TITLES.length - 1];
  return LEVEL_TITLES[lvl - 1];
};

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

  const todayFocus = useMemo(() => {
    return focusSessions.find((s) => s.date === today)?.minutes ?? 0;
  }, [focusSessions, today]);

  const completedToday = useMemo(() => {
    return tasks.filter((t) => t.dueDate === today && t.completed).length;
  }, [tasks, today]);

  const habitsDoneToday = useMemo(() => {
    return habits.filter((h) => h.history[today]).length;
  }, [habits, today]);

  // ========== 2. DYNAMIC QUESTS BOARD (RPG Quests) ==========
  const quests = useMemo(() => {
    return [
      {
        id: "q_1",
        title: "Focus Spark",
        goal: "Log at least 25 focus minutes today",
        type: "daily",
        difficulty: "Common",
        reward: 50,
        current: todayFocus,
        target: 25,
        completed: todayFocus >= 25,
        color: "text-neon-cyan",
        border: "border-neon-cyan/20",
      },
      {
        id: "q_2",
        title: "Habit Link",
        goal: "Log at least 2 habit check-ins today",
        type: "daily",
        difficulty: "Rare",
        reward: 75,
        current: habitsDoneToday,
        target: 2,
        completed: habitsDoneToday >= 2,
        color: "text-neon-purple",
        border: "border-neon-purple/20",
      },
      {
        id: "q_3",
        title: "Clean Slayer",
        goal: "Complete at least 1 task due today",
        type: "daily",
        difficulty: "Epic",
        reward: 100,
        current: completedToday,
        target: 1,
        completed: completedToday >= 1,
        color: "text-neon-pink",
        border: "border-neon-pink/20",
      },
      {
        id: "q_4",
        title: "Flow State Grind",
        goal: "Accumulate 120 focus minutes this week",
        type: "weekly",
        difficulty: "Rare",
        reward: 150,
        current: totalFocusMinutes,
        target: 120,
        completed: totalFocusMinutes >= 120,
        color: "text-neon-blue",
        border: "border-neon-blue/20",
      },
      {
        id: "q_5",
        title: "Task Overlord",
        goal: "Complete 5 productivity tasks overall",
        type: "weekly",
        difficulty: "Legendary",
        reward: 300,
        current: totalCompletedTasks,
        target: 5,
        completed: totalCompletedTasks >= 5,
        color: "text-yellow-400",
        border: "border-yellow-400/20",
      },
    ];
  }, [todayFocus, habitsDoneToday, completedToday, totalFocusMinutes, totalCompletedTasks]);

  const completedQuestsCount = useMemo(() => quests.filter((q) => q.completed).length, [quests]);

  // ========== 3. RPG ACHIEVEMENT BADGES ==========
  const achievements = useMemo(() => {
    return [
      {
        id: "ach_1",
        title: "Initiate Spark",
        description: "Earn 100 Flow Points (FP)",
        tier: "Bronze",
        icon: Zap,
        unlocked: xp >= 100,
        current: xp,
        target: 100,
        color: "from-amber-600 to-amber-700",
        shadow: "rgba(180, 83, 9, 0.3)",
      },
      {
        id: "ach_2",
        title: "Mana Surge",
        description: "Earn 1,000 Flow Points (FP)",
        tier: "Gold",
        icon: Star,
        unlocked: xp >= 1000,
        current: xp,
        target: 1000,
        color: "from-amber-400 to-yellow-500",
        shadow: "rgba(245, 158, 11, 0.4)",
      },
      {
        id: "ach_3",
        title: "Streak Zealot",
        description: "Reach a 3-day active streak",
        tier: "Bronze",
        icon: Flame,
        unlocked: streakCount >= 3,
        current: streakCount,
        target: 3,
        color: "from-orange-500 to-red-500",
        shadow: "rgba(249, 115, 22, 0.3)",
      },
      {
        id: "ach_4",
        title: "Consistency Lord",
        description: "Reach a 7-day active streak",
        tier: "Gold",
        icon: Shield,
        unlocked: streakCount >= 7,
        current: streakCount,
        target: 7,
        color: "from-red-500 to-pink-500",
        shadow: "rgba(239, 68, 68, 0.4)",
      },
      {
        id: "ach_5",
        title: "Zen Apprentice",
        description: "Accumulate 60 minutes of deep focus",
        tier: "Silver",
        icon: Timer,
        unlocked: totalFocusMinutes >= 60,
        current: totalFocusMinutes,
        target: 60,
        color: "from-slate-300 to-slate-400",
        shadow: "rgba(148, 163, 184, 0.3)",
      },
      {
        id: "ach_6",
        title: "Flow Master",
        description: "Accumulate 300 minutes of deep focus",
        tier: "Legendary",
        icon: Trophy,
        unlocked: totalFocusMinutes >= 300,
        current: totalFocusMinutes,
        target: 300,
        color: "from-indigo-500 to-purple-600",
        shadow: "rgba(99, 102, 241, 0.4)",
      },
      {
        id: "ach_7",
        title: "Quest Conqueror",
        description: "Complete 10 total tasks",
        tier: "Silver",
        icon: CheckSquare,
        unlocked: totalCompletedTasks >= 10,
        current: totalCompletedTasks,
        target: 10,
        color: "from-emerald-400 to-teal-500",
        shadow: "rgba(52, 211, 153, 0.3)",
      },
      {
        id: "ach_8",
        title: "Habit Archmage",
        description: "Log 20 total habit completions",
        tier: "Legendary",
        icon: Activity,
        unlocked: totalCompletedHabits >= 20,
        current: totalCompletedHabits,
        target: 20,
        color: "from-pink-500 to-rose-600",
        shadow: "rgba(244, 63, 94, 0.4)",
      },
    ];
  }, [xp, streakCount, totalFocusMinutes, totalCompletedTasks, totalCompletedHabits]);

  const unlockedCount = useMemo(() => achievements.filter((a) => a.unlocked).length, [achievements]);

  // Next level progress variables
  const xpInLevel = xp % 500;
  const levelTitle = useMemo(() => getLevelTitle(level), [level]);

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="RPG Hub & Performance"
          subtitle="Unlock milestones, embark on daily quests, and level up your productivity rank."
        />

        {/* Character Status Card Sheet */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2 p-6 flex flex-col justify-between border border-neon-purple/20 relative overflow-hidden bg-gradient-to-r from-neon-purple/10 to-transparent">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Compass className="h-44 w-44" />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 z-10">
              <div className="h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center glow-primary text-white text-3xl font-bold">
                {level}
              </div>
              <div className="space-y-1 text-center sm:text-left flex-1">
                <span className="text-[10px] font-semibold text-neon-cyan uppercase tracking-widest">Character Class</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">{levelTitle}</h2>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-neon-cyan" /> {xp} Flow Points (FP)</span>
                  <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-neon-pink" /> {streakCount}-day streak</span>
                </div>
              </div>
            </div>

            {/* Level progress bar */}
            <div className="space-y-2 pt-6">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Level {level} Progress</span>
                <span className="font-semibold text-white">{xpInLevel} / 500 FP</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(xpInLevel / 500) * 100}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </GlassCard>

          {/* Quick Stats Sheet */}
          <GlassCard className="p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-neon-cyan" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Character Stats</h3>
            </div>
            
            <div className="space-y-3 flex-1 justify-center flex flex-col">
              <div className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                <span className="text-muted-foreground flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-neon-cyan" /> Deep Focus Time</span>
                <span className="font-bold text-white">{totalFocusMinutes} min</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                <span className="text-muted-foreground flex items-center gap-1.5"><CheckSquare className="h-3.5 w-3.5 text-neon-purple" /> Tasks Completed</span>
                <span className="font-bold text-white">{totalCompletedTasks}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-muted-foreground flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-neon-pink" /> Habits Logged</span>
                <span className="font-bold text-white">{totalCompletedHabits}</span>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground/60 text-center pt-4 italic">
              Perform daily activities to increase your statistics.
            </div>
          </GlassCard>
        </div>

        {/* Quest Board (RPG replacement for focus graph) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-neon-pink" />
                <h3 className="text-base font-semibold">Active Quest Board</h3>
              </div>
              <span className="text-[10px] font-bold text-neon-cyan px-2.5 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20">
                {completedQuestsCount} / {quests.length} completed
              </span>
            </div>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
              {quests.map((q) => {
                const questPct = Math.min(100, Math.round((q.current / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      q.completed
                        ? "bg-white/5 border-neon-cyan/35 opacity-90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "bg-white/5 border-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold text-white ${q.completed ? "line-through text-muted-foreground" : ""}`}>
                            {q.title}
                          </span>
                          <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                            q.difficulty === "Legendary" ? "bg-yellow-500/20 text-yellow-400" :
                            q.difficulty === "Epic" ? "bg-neon-pink/20 text-neon-pink" :
                            q.difficulty === "Rare" ? "bg-neon-purple/20 text-neon-purple" : "bg-white/10 text-muted-foreground"
                          }`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{q.goal}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-neon-cyan block">+{q.reward} FP</span>
                        <span className="text-[9px] text-muted-foreground block uppercase mt-0.5">
                          {q.completed ? "COMPLETED" : `${q.current}/${q.target}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                          style={{ width: `${questPct}%` }}
                        />
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] transition-all flex-shrink-0 ${
                        q.completed ? "bg-neon-cyan border-neon-cyan text-background font-bold" : "border-white/20"
                      }`}>
                        {q.completed && "✓"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Achievements breakdown list by Rank */}
          <GlassCard className="p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-neon-purple" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Unlockable Tiers</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tackle operational missions, sustain consistency streaks, and level up to unlock elite trophy items.
              </p>
              
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-600/10 border border-amber-600/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-600" />
                    <span className="text-xs font-semibold text-white">Bronze Badges</span>
                  </div>
                  <span className="text-xs font-bold text-amber-500">
                    {achievements.filter(a => a.tier === "Bronze" && a.unlocked).length} / {achievements.filter(a => a.tier === "Bronze").length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-300/10 border border-slate-300/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-semibold text-white">Silver Badges</span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {achievements.filter(a => a.tier === "Silver" && a.unlocked).length} / {achievements.filter(a => a.tier === "Silver").length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="text-xs font-semibold text-white">Gold Badges</span>
                  </div>
                  <span className="text-xs font-bold text-yellow-400">
                    {achievements.filter(a => a.tier === "Gold" && a.unlocked).length} / {achievements.filter(a => a.tier === "Gold").length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-semibold text-white">Legendary Badges</span>
                  </div>
                  <span className="text-xs font-bold text-purple-400">
                    {achievements.filter(a => a.tier === "Legendary" && a.unlocked).length} / {achievements.filter(a => a.tier === "Legendary").length}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Operational Rank:</span>
              <span className="font-semibold text-neon-cyan">Lvl {level} {levelTitle.split(" ").slice(-1)[0]}</span>
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
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-sm group-hover:text-neon-cyan transition-colors">
                          {ach.title}
                        </h4>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        {ach.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="text-[9px] font-semibold text-neon-purple uppercase">{ach.tier}</span>
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
