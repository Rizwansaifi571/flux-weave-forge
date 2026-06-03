  import { createFileRoute, Link } from "@tanstack/react-router";
  import { motion, AnimatePresence } from "framer-motion";
  import { useStore, motivationalQuotes, todayStr } from "@/lib/store";
  import { AppShell } from "@/components/AppShell";
  import { GlassCard } from "@/components/GlassCard";
  import { PageHeader } from "@/components/PageHeader";
  import { WallpaperPreview } from "@/components/WallpaperPreview";
  import {
    CheckCircle2, Clock, Flame, ListTodo, TrendingUp, Trophy, Zap,
    Calendar, BarChart3, Target, Award, Layers, ArrowUpRight,
    Sparkles, Brain, CheckSquare, XCircle, AlertCircle
  } from "lucide-react";
  import { useEffect, useMemo, useState } from "react";
  import {
    Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
    Bar, BarChart, CartesianGrid, Legend, PieChart, Pie, Cell
  } from "recharts";

  export const Route = createFileRoute("/")({
    component: Index,
  });

  // Color palette for charts
  const CHART_COLORS = {
    completed: "#c084fc",
    pending: "#475569",
    purple: "#a855f7",
    cyan: "#06b6d4",
    pink: "#ec4899",
    gradient: ["#a855f7", "#d946ef", "#ec4899"]
  };

  function Index() {
    const { tasks, habits, focusSessions, xp, userName = "Explorer" } = useStore();
    const today = todayStr();

    // ========== 1. TASK COMPLETION STREAK (based on tasks only) ==========
    const taskStreak = useMemo(() => {
      // Get all dates where at least one task was completed
      const completionDates = new Set<string>();
      tasks.forEach((task) => {
        if (task.completed && task.dueDate) {
          completionDates.add(task.dueDate);
        }
      });
      if (completionDates.size === 0) return 0;

      let streak = 0;
      let current = new Date();
      current.setHours(0, 0, 0, 0);
      for (let i = 0; i < 365; i++) {
        const dateStr = current.toISOString().slice(0, 10);
        if (completionDates.has(dateStr)) {
          streak++;
          current.setDate(current.getDate() - 1);
        } else break;
      }
      return streak;
    }, [tasks]);

    // ========== 2. TASKS TODAY ==========
    const todaysTasks = useMemo(
      () => tasks.filter((t) => t.dueDate === today),
      [tasks, today]
    );
    const completedToday = useMemo(
      () => todaysTasks.filter((t) => t.completed).length,
      [todaysTasks]
    );
    const pendingToday = todaysTasks.length - completedToday;
    const completionRateToday = todaysTasks.length
      ? Math.round((completedToday / todaysTasks.length) * 100)
      : 0;

    // ========== 3. WEEKLY TASK COMPLETION (last 7 days) ==========
    const weeklyTaskData = useMemo(() => {
      const last7Days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().slice(0, 10));
      }
      return last7Days.map((date) => {
        const dayTasks = tasks.filter((t) => t.dueDate === date);
        const completed = dayTasks.filter((t) => t.completed).length;
        const total = dayTasks.length;
        return {
          day: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
          completed,
          total,
          rate: total ? Math.round((completed / total) * 100) : 0,
        };
      });
    }, [tasks]);

    // ========== 4. TASK PRIORITY BREAKDOWN ==========
    const priorityStats = useMemo(() => {
      const high = tasks.filter(t => t.priority === "high" && !t.completed).length;
      const medium = tasks.filter(t => t.priority === "medium" && !t.completed).length;
      const low = tasks.filter(t => t.priority === "low" && !t.completed).length;
      const total = high + medium + low;
      return { high, medium, low, total };
    }, [tasks]);

    // ========== 5. TOTAL STATS ==========
    const totalTasks = tasks.length;
    const completedTotal = tasks.filter(t => t.completed).length;
    const overallCompletion = totalTasks ? Math.round((completedTotal / totalTasks) * 100) : 0;
    const pendingTotal = totalTasks - completedTotal;

    // ========== 6. PRODUCTIVITY SCORE (task-focused) ==========
    const productivityScore = useMemo(() => {
      const todayScore = completionRateToday;
      const weeklyAvg = weeklyTaskData.reduce((sum, d) => sum + d.rate, 0) / 7;
      return Math.min(100, Math.round((todayScore * 0.5) + (weeklyAvg * 0.3) + (taskStreak * 2)));
    }, [completionRateToday, weeklyTaskData, taskStreak]);

    // ========== 7. HABITS (keep but secondary) ==========
    const habitsDone = useMemo(
      () => habits.filter((h) => h.history[today]).length,
      [habits, today]
    );
    const totalHabits = habits.length;
    const habitsScore = totalHabits === 0 ? 0 : (habitsDone / totalHabits) * 100;

    // ========== 8. GREETING & QUOTE ==========
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

    // ========== 9. MOTIVATIONAL MESSAGE BASED ON SCORE ==========
    const getMotivationMessage = () => {
      if (completionRateToday === 100 && todaysTasks.length > 0) return "🎉 Perfect day! You crushed every task!";
      if (completionRateToday >= 70) return "🔥 Amazing progress! Keep this momentum going.";
      if (completionRateToday >= 40) return "💪 You're on the right track. Finish the remaining tasks.";
      if (completionRateToday > 0) return "⭐ Good start! Tackle one more task to build streak.";
      if (todaysTasks.length === 0) return "🌱 No tasks for today. Plan ahead to stay productive.";
      return "🚀 Ready to begin? Complete your first task now!";
    };

    return (
      <AppShell>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Header with productivity ring */}
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4 mb-8 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
                <span suppressHydrationWarning>
                  {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-semibold tracking-tight"
              >
                <span suppressHydrationWarning>{greeting}</span>,{" "}
                <span className="text-gradient">{userName}</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-sm text-muted-foreground italic mt-2 max-w-xl"
              >
                <span suppressHydrationWarning>“{quote}”</span>
              </motion.p>
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
                    {productivityScore >= 80 ? "Elite mode" : productivityScore >= 50 ? "On track" : "Push harder"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span suppressHydrationWarning>
                      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Stat Cards – Task Focused */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={CheckCircle2}
              label="Completed Today"
              value={completedToday}
              suffix={`/${todaysTasks.length}`}
              accent="from-neon-purple to-neon-pink"
              delay={0}
            />
            <StatCard
              icon={ListTodo}
              label="Pending Total"
              value={pendingTotal}
              accent="from-neon-blue to-neon-cyan"
              delay={0.05}
            />
            <StatCard
              icon={Flame}
              label="Task Streak"
              value={taskStreak}
              suffix="days"
              accent="from-neon-pink to-neon-purple"
              delay={0.1}
            />
            <StatCard
              icon={Target}
              label="Completion Rate"
              value={overallCompletion}
              suffix="%"
              accent="from-neon-cyan to-neon-blue"
              delay={0.15}
            />
          </div>

          {/* Main Chart & Wallpaper */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <GlassCard className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Weekly Task Mastery
                  </div>
                  <h3 className="text-lg font-semibold mt-1">Completed vs. Assigned</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neon-cyan">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {weeklyTaskData.reduce((sum, d) => sum + d.completed, 0) > 0
                    ? `+${weeklyTaskData[weeklyTaskData.length-1]?.completed || 0} today`
                    : "Start completing tasks"}
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTaskData} barGap={8}>
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.5} />
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
                      formatter={(value, name) => [value, name === "completed" ? "Completed" : "Assigned"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Assigned" fill="#475569" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="url(#completedGrad)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Live wallpaper</div>
                  <h3 className="text-lg font-semibold mt-1">Your screen</h3>
                </div>
                <Link to="/wallpaper" className="text-xs text-neon-cyan hover:text-neon-purple transition flex items-center gap-1">
                  Customize <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="scale-95">
                <WallpaperPreview scale={0.6} />
              </div>
            </GlassCard>
          </div>

          {/* Three-column: Tasks, Habits, Priority Pie & AI Insight */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Today's Tasks */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Today's Tasks</h3>
                <Link to="/tasks" className="text-xs text-neon-cyan hover:text-neon-purple flex items-center gap-1">
                  All <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {todaysTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No tasks due today.<br />Add some missions!
                </div>
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{completedToday}/{todaysTasks.length} ({completionRateToday}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-pink"
                        initial={{ width: 0 }}
                        animate={{ width: `${completionRateToday}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {todaysTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        whileHover={{ x: 4 }}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 transition"
                      >
                        <div className={`h-2 w-2 rounded-full ${
                          task.completed
                            ? "bg-neon-cyan"
                            : task.priority === "high" ? "bg-neon-pink" : "bg-neon-purple"
                        }`} />
                        <span className={`text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        {task.priority === "high" && <AlertCircle className="h-3 w-3 text-neon-pink" />}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </GlassCard>

            {/* Habits (quick view) */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Habits Today</h3>
                <Link to="/habits" className="text-xs text-neon-cyan hover:text-neon-purple flex items-center gap-1">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {habits.slice(0, 5).map((habit) => (
                  <div key={habit.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                    <span className="text-lg">{habit.emoji}</span>
                    <span className="text-sm flex-1">{habit.name}</span>
                    <div className={`h-2 w-2 rounded-full ${habit.history[today] ? "bg-neon-cyan glow-soft" : "bg-white/10"}`} />
                  </div>
                ))}
                {habits.length === 0 && (
                  <p className="text-sm text-muted-foreground">No habits yet. Create one to build consistency.</p>
                )}
              </div>
              {totalHabits > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Habit completion</span>
                    <span>{habitsDone}/{totalHabits} ({Math.round(habitsScore)}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-blue"
                      initial={{ width: 0 }}
                      animate={{ width: `${habitsScore}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Priority Pie + AI Insight */}
            <GlassCard className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-neon-purple" />
                  <h3 className="text-lg font-semibold">Priority Backlog</h3>
                </div>
                {priorityStats.total > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-28 w-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "High", value: priorityStats.high, color: "#ec4899" },
                              { name: "Medium", value: priorityStats.medium, color: "#c084fc" },
                              { name: "Low", value: priorityStats.low, color: "#06b6d4" },
                            ]}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={42}
                            paddingAngle={2}
                          >
                            {priorityStats.high > 0 && <Cell fill="#ec4899" />}
                            {priorityStats.medium > 0 && <Cell fill="#c084fc" />}
                            {priorityStats.low > 0 && <Cell fill="#06b6d4" />}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-neon-pink" /> High</span>
                        <span className="font-medium">{priorityStats.high}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-neon-purple" /> Medium</span>
                        <span className="font-medium">{priorityStats.medium}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-neon-cyan" /> Low</span>
                        <span className="font-medium">{priorityStats.low}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No pending tasks. Great job!</p>
                )}

                {/* AI Insight - task motivated */}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-neon-purple" />
                    <span className="text-xs font-semibold uppercase tracking-wider">AI Insight</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {getMotivationMessage()}
                    {pendingTotal > 0 && (
                      <span className="block mt-1 text-xs text-neon-cyan">
                        Next:{" "}
                        {tasks.find(t => !t.completed && t.priority === "high")?.title ||
                          tasks.find(t => !t.completed)?.title ||
                          "relax and plan tomorrow"}
                      </span>
                    )}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="glass rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3 w-3 text-neon-pink" />
                        <span className="text-muted-foreground">XP</span>
                      </div>
                      <div className="text-base font-semibold mt-0.5">{xp}</div>
                    </div>
                    <div className="glass rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5">
                        <Award className="h-3 w-3 text-neon-cyan" />
                        <span className="text-muted-foreground">Streak</span>
                      </div>
                      <div className="text-base font-semibold mt-0.5">{taskStreak} days</div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Optional: Weekly completion rate line chart (adds more insight) */}
          <div className="mt-6">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Trend analysis</div>
                  <h3 className="text-lg font-semibold mt-1">Completion rate trend (last 7 days)</h3>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTaskData}>
                    <defs>
                      <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.6 0.02 270)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Completion rate"]}
                      contentStyle={{
                        background: "oklch(0.18 0.03 270 / 0.95)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                        backdropFilter: "blur(20px)",
                      }}
                    />
                    <Area type="monotone" dataKey="rate" stroke="#c084fc" strokeWidth={2.5} fill="url(#rateGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* SVG Gradients */}
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="productivityGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
      </AppShell>
    );
  }

  // Enhanced StatCard with better animations and tooltip
  interface StatCardProps {
    icon: React.ElementType;
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
        transition={{ delay, duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -5, scale: 1.02 }}
        className="glass rounded-2xl p-5 relative overflow-hidden group cursor-default"
      >
        <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500`} />
        <Icon className="h-5 w-5 text-muted-foreground mb-3 group-hover:text-neon-purple transition-colors" />
        <div className="text-3xl font-semibold tracking-tight">
          {value}
          {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </motion.div>
    );
  }
