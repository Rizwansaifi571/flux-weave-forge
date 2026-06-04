import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Habit, type HabitCategory, type HabitDifficulty } from "@/lib/store";
import { formatLocalDate, startOfLocalDay } from "@/lib/date";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Flame, TrendingUp, Calendar, Award, Zap,
  Brain, Lightbulb, BarChart3, ListChecks, Filter, X, Edit2,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Circle,
  Target, Clock
} from "lucide-react";

export const Route = createFileRoute("/habits")({ component: HabitsPage });

// ---------- Constants ----------
const COLORS = ["neon-purple", "neon-blue", "neon-cyan", "neon-pink"];
const CATEGORIES: HabitCategory[] = ["health", "learning", "career", "fitness", "spiritual", "personal"];
const DIFFICULTIES: HabitDifficulty[] = ["easy", "medium", "hard"];

const TEMPLATES = [
  { name: "🚀 Placement Prep", habits: ["DSA", "Aptitude", "CS Fundamentals"], category: "learning", difficulty: "hard" },
  { name: "🏋️ Fitness", habits: ["Workout", "Drink water", "Sleep 8h"], category: "fitness", difficulty: "medium" },
  { name: "📚 Study Mode", habits: ["Revision", "Practice problems", "Reading"], category: "learning", difficulty: "medium" },
];

// ---------- Safe date helpers (no external dependencies) ----------
function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(formatLocalDate(date));
  }
  return days;
}

function getStreak(history: Record<string, boolean>, todayStr: string): number {
  let streak = 0;
  let cursor = startOfLocalDay();
  while (history[formatLocalDate(cursor)] === true) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getCompletionRate(history: Record<string, boolean>, days: string[]): number {
  const completed = days.filter(d => history[d] === true).length;
  return days.length ? (completed / days.length) * 100 : 0;
}

function getHabitScore(habit: Habit, todayStr: string, last30Days: string[]): number {
  const streak = getStreak(habit.history, todayStr);
  const rate = getCompletionRate(habit.history, last30Days);
  return Math.round((rate * 0.6) + (Math.min(streak, 100) * 0.4));
}

function getPrediction(habit: Habit, todayStr: string): number {
  const last7 = getLastNDays(7).slice(0, 6);
  const completedCount = last7.filter(d => habit.history[d] === true).length;
  const baseProb = (completedCount / 6) * 100;
  const streak = getStreak(habit.history, todayStr);
  return Math.min(100, Math.round(baseProb + (streak > 3 ? 10 : 0)));
}

function getBestTime(habit: Habit): string {
  const hours = [6, 7, 8, 9, 12, 15, 18, 19, 20, 21, 22];
  const idx = habit.name.length % hours.length;
  return `${hours[idx]}:00`;
}

function getLongestStreak(history: Record<string, boolean>): number {
  let max = 0, curr = 0;
  for (const date of Object.keys(history).sort()) {
    if (history[date]) curr++;
    else { max = Math.max(max, curr); curr = 0; }
  }
  return Math.max(max, curr);
}

// ---------- Components ----------
function WeeklyMomentumChart({ habits, days }: { habits: Habit[]; days: string[] }) {
  const weeklyData = days.slice(-7).map(day => ({
    day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
    completed: habits.filter(h => h.history[day] === true).length
  }));
  const max = Math.max(...weeklyData.map(d => d.completed), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {weeklyData.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <motion.div
            className="w-full rounded-t bg-gradient-to-t from-neon-purple to-neon-cyan"
            initial={{ height: 0 }}
            animate={{ height: `${(d.completed / max) * 100}%` }}
            style={{ minHeight: d.completed > 0 ? '4px' : '0' }}
          />
          <span className="text-[10px] mt-1 text-muted-foreground">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ current, target, unit }: { current: number; target: number; unit: string }) {
  const percent = Math.min(100, (current / target) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{current} / {target} {unit}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="text-green-400">🟢 Safe</span>;
  if (score >= 40) return <span className="text-yellow-400">🟡 Medium</span>;
  return <span className="text-red-400">🔴 High</span>;
}

// ---------- Main Page ----------
function HabitsPage() {
  const {
    habits,
    goals,
    addHabit,
    deleteHabit,
    toggleHabit,
    updateHabitProgress,
    addHabitNote,
  } = useStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerHabit, setDrawerHabit] = useState<Habit | null>(null);
  const [filterCategory, setFilterCategory] = useState<HabitCategory | "all">("all");
  const [filterDifficulty, setFilterDifficulty] = useState<HabitDifficulty | "all">("all");
  const [heatmapView, setHeatmapView] = useState<"month" | "quarter" | "year">("month");
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(0);
  const [builderGoal, setBuilderGoal] = useState("");
  const [builderDuration, setBuilderDuration] = useState("");
  const [builderTime, setBuilderTime] = useState("");
  const [editingNote, setEditingNote] = useState<{ habitId: string; date: string; text: string } | null>(null);

  const today = formatLocalDate(new Date());
  const last30Days = getLastNDays(30);
  const last90Days = getLastNDays(90);
  const yearDays = getLastNDays(365);

  const filteredHabits = useMemo(() => habits.filter(h => 
    (filterCategory === "all" || h.category === filterCategory) &&
    (filterDifficulty === "all" || h.difficulty === filterDifficulty)
  ), [habits, filterCategory, filterDifficulty]);

  const currentStreak = Math.max(...habits.map(h => getStreak(h.history, today)), 0);
  const habitsToday = habits.filter(h => !h.history[today]).length;
  const totalHabits = habits.length;
  const completedToday = habits.filter(h => h.history[today]).length;
  const completionRate = totalHabits ? Math.round((completedToday / totalHabits) * 100) : 0;
  const atRiskCount = habits.filter(h => getHabitScore(h, today, last30Days) < 40).length;

  // AI Coach insights
  const coachInsights = useMemo(() => {
    if (habits.length === 0) return [];
    const insights = [];
    const best = [...habits].sort((a,b) => getHabitScore(b, today, last30Days) - getHabitScore(a, today, last30Days))[0];
    insights.push(`🏆 Your best habit is **${best.name}** with score ${getHabitScore(best, today, last30Days)}.`);
    const worst = [...habits].sort((a,b) => getCompletionRate(a.history, last30Days) - getCompletionRate(b.history, last30Days))[0];
    insights.push(`⚠️ **${worst.name}** is skipped most often (${Math.round(getCompletionRate(worst.history, last30Days))}% completion). Try moving it to morning.`);
    const habitWithBestTime = habits.find(h => getCompletionRate(h.history, last30Days) > 70);
    if (habitWithBestTime) insights.push(`⏰ You usually complete **${habitWithBestTime.name}** around ${getBestTime(habitWithBestTime)}. That's your peak productivity window.`);
    const lastWeek = getLastNDays(7);
    const prevWeek = getLastNDays(14).slice(0,7);
    const currentWeekRate = habits.reduce((acc,h) => acc + getCompletionRate(h.history, lastWeek),0) / habits.length;
    const prevWeekRate = habits.reduce((acc,h) => acc + getCompletionRate(h.history, prevWeek),0) / habits.length;
    if (currentWeekRate > prevWeekRate) insights.push(`📈 Your consistency improved by ${Math.round(currentWeekRate - prevWeekRate)}% this week. Keep going!`);
    else if (prevWeekRate > currentWeekRate) insights.push(`📉 Your consistency dropped by ${Math.round(prevWeekRate - currentWeekRate)}% this week. Let's focus on small wins.`);
    return insights;
  }, [habits, today, last30Days]);

  const weeklyReview = useMemo(() => {
    const last7 = getLastNDays(7);
    const completions = habits.map(h => ({
      name: h.name,
      completed: last7.filter(d => h.history[d]).length,
      rate: (last7.filter(d => h.history[d]).length / 7) * 100
    }));
    const strengths = completions.filter(c => c.rate >= 70).slice(0,2);
    const weaknesses = completions.filter(c => c.rate < 40).slice(0,2);
    let review = `You completed ${completions.reduce((s,c)=>s+c.completed,0)} out of ${habits.length * 7} habits this week. `;
    if (strengths.length) review += `Strengths: ${strengths.map(s=>s.name).join(', ')}. `;
    if (weaknesses.length) review += `Needs improvement: ${weaknesses.map(w=>w.name).join(', ')}. `;
    if (weaknesses.length) review += `Recommendation: Move ${weaknesses[0].name} to your most productive hour.`;
    return review;
  }, [habits]);

  const remainingHabits = habits.filter(h => !h.history[today]);
  const mostImportant = remainingHabits.length ? [...remainingHabits].sort((a,b) => getHabitScore(b, today, last30Days) - getHabitScore(a, today, last30Days))[0] : null;
  const estimatedTotalTime = remainingHabits.reduce((sum, h) => sum + (h.goal?.target ? Math.min(120, h.goal.target * 10) : 30), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const addTemplate = (tmpl: typeof TEMPLATES[0]) => {
    tmpl.habits.forEach(name => {
      addHabit({
        name, emoji: "📌", color: COLORS[habits.length % COLORS.length],
        category: tmpl.category as HabitCategory, difficulty: tmpl.difficulty as HabitDifficulty,
        goal: { target: 1, current: 0, unit: "session" }
      });
    });
  };

  const handleBuilderNext = () => {
    if (builderStep === 0 && builderGoal.trim()) setBuilderStep(1);
    else if (builderStep === 1 && builderDuration) setBuilderStep(2);
    else if (builderStep === 2 && builderTime) {
      addHabit({
        name: builderGoal.slice(0, 30), emoji: "🤖", color: COLORS[habits.length % COLORS.length],
        category: builderGoal.toLowerCase().includes("code") ? "learning" : "personal",
        difficulty: builderTime.includes("2") ? "hard" : "medium",
        goal: { target: parseInt(builderTime.match(/\d+/)?.[0] || "1"), current: 0, unit: "hours" }
      });
      setShowBuilder(false); setBuilderStep(0); setBuilderGoal(""); setBuilderDuration(""); setBuilderTime("");
    }
  };

  const predictions = useMemo(() => habits.map(h => ({ id: h.id, prob: getPrediction(h, today) })), [habits, today]);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Dashboard Hero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center"><Flame className="h-6 w-6 text-orange-400 mx-auto mb-1"/><p className="text-2xl font-bold">{currentStreak}</p><p className="text-xs">Current Streak</p></GlassCard>
          <GlassCard className="p-4 text-center"><ListChecks className="h-6 w-6 text-neon-cyan mx-auto mb-1"/><p className="text-2xl font-bold">{habitsToday}/{totalHabits}</p><p className="text-xs">Habits Today</p></GlassCard>
          <GlassCard className="p-4 text-center"><TrendingUp className="h-6 w-6 text-green-400 mx-auto mb-1"/><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs">Completion Rate</p></GlassCard>
          <GlassCard className="p-4 text-center"><AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-1"/><p className="text-2xl font-bold">{atRiskCount}</p><p className="text-xs">At Risk</p></GlassCard>
        </div>

        {/* Weekly Momentum */}
        <GlassCard className="p-5"><h3 className="text-sm font-semibold mb-3">Weekly Momentum</h3><WeeklyMomentumChart habits={habits} days={last30Days} /></GlassCard>

        {/* Today's Mission */}
        <GlassCard className="p-5 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Target className="h-5 w-5" />Today's Mission</h2>
          <div className="flex flex-wrap justify-between items-end">
            <div><p className="text-sm">{remainingHabits.length} habits remaining</p>{mostImportant && <p className="text-sm mt-1">🎯 Most important: <strong>{mostImportant.name}</strong></p>}<p className="text-xs mt-1">⏱️ Estimated time: {Math.ceil(estimatedTotalTime / 60)}h {estimatedTotalTime % 60}m</p></div>
            <div className="text-right"><p className="text-2xl font-bold">{completedToday}/{totalHabits}</p><p className="text-xs">completed today</p></div>
          </div>
        </GlassCard>

        {/* AI Coach */}
        <GlassCard className="p-5"><div className="flex items-center gap-2 mb-3"><Brain className="h-5 w-5 text-neon-cyan" />AI Coach</div><ul className="space-y-2 text-sm">{coachInsights.map((insight,i)=><li key={i} className="flex gap-2"><Lightbulb className="h-4 w-4 mt-0.5 text-yellow-400"/>{insight}</li>)}</ul></GlassCard>

        {/* Briefing */}
        <GlassCard className="p-4"><p className="text-sm">🌅 Good {greeting}, {useStore.getState().userName || "Rizwan"}! You've completed {completedToday}/{totalHabits} habits. {mostImportant ? `Your priority today: ${mostImportant.name}.` : "Great job!"}</p></GlassCard>

        {/* Filters & AI Builder */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2"><Filter className="h-4 w-4"/><select value={filterCategory} onChange={e=>setFilterCategory(e.target.value as any)} className="glass rounded-lg px-2 py-1 text-xs"><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select value={filterDifficulty} onChange={e=>setFilterDifficulty(e.target.value as any)} className="glass rounded-lg px-2 py-1 text-xs"><option value="all">All difficulties</option>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
          <button onClick={()=>setShowBuilder(true)} className="text-xs bg-neon-purple/20 px-3 py-1 rounded-full">+ AI Builder</button>
        </div>

        {/* Habit Cards (Collapsible) */}
        <div className="space-y-3">
          {filteredHabits.map(habit => {
            const streak = getStreak(habit.history, today);
            const rate = getCompletionRate(habit.history, last30Days);
            const score = getHabitScore(habit, today, last30Days);
            const prediction = predictions.find(p=>p.id===habit.id)?.prob || 50;
            const isExpanded = expandedId === habit.id;
            const heatmapDays = heatmapView === "year" ? yearDays : heatmapView === "quarter" ? last90Days : last30Days.slice(-90);
            const noteForToday = habit.notes?.[today] || "";
            return (
              <GlassCard key={habit.id} className="!p-0 overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-white/5 transition flex justify-between items-center" onClick={()=>setExpandedId(isExpanded?null:habit.id)}>
                  <div className="flex items-center gap-3"><span className="text-2xl">{habit.emoji}</span><div><div className="font-medium">{habit.name}</div><div className="flex gap-3 text-xs text-muted-foreground mt-0.5"><span>🔥 {streak} days</span><span>📈 {Math.round(rate)}%</span>{habit.goal && <span>🎯 {habit.goal.current}/{habit.goal.target} {habit.goal.unit}</span>}<RiskBadge score={score} /><span className={`${prediction>70?'text-green-400':prediction>40?'text-yellow-400':'text-red-400'}`}>🔮 {prediction}%</span></div></div></div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e)=>{e.stopPropagation(); toggleHabit(habit.id, today);}} className="rounded-full p-1">{habit.history[today]?<CheckCircle className="h-5 w-5 text-neon-cyan"/>:<Circle className="h-5 w-5 text-white/30"/>}</button>
                    {isExpanded?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{height:0}} animate={{height:"auto"}} exit={{height:0}} className="border-t border-white/10 p-4 space-y-3">
                      {habit.goal && <ProgressBar current={habit.goal.current} target={habit.goal.target} unit={habit.goal.unit} />}
                      <div className="flex flex-wrap gap-2 text-xs"><span className="glass px-2 py-1 rounded-full">{habit.category}</span><span className="glass px-2 py-1 rounded-full">{habit.difficulty}</span><button onClick={()=>setDrawerHabit(habit)} className="text-neon-cyan underline">Details</button><button onClick={()=>deleteHabit(habit.id)} className="text-red-400 underline">Delete</button></div>
                      <div className="flex justify-between items-center"><div className="flex gap-1">{heatmapView==="year"&&<button onClick={()=>setHeatmapView("month")}>Month</button>}{heatmapView==="quarter"&&<button onClick={()=>setHeatmapView("year")}>Year</button>}{heatmapView==="month"&&<button onClick={()=>setHeatmapView("quarter")}>90d</button>}</div><div className="grid grid-cols-[repeat(90,minmax(0,1fr))] gap-0.5 overflow-x-auto max-w-full">{heatmapDays.slice(-90).map((date,idx)=><div key={idx} className={`aspect-square rounded-sm ${habit.history[date]?`bg-${habit.color}`:"bg-white/5"} hover:scale-125 transition`} style={habit.history[date]?{background:habit.color==="neon-purple"?"oklch(0.7 0.24 305)":habit.color==="neon-blue"?"oklch(0.72 0.2 250)":habit.color==="neon-cyan"?"oklch(0.85 0.16 195)":"oklch(0.72 0.24 350)"}:undefined} title={date} />)}</div></div>
                      <div className="flex items-center gap-2"><button onClick={()=>setEditingNote({habitId:habit.id, date:today, text:noteForToday})} className="text-xs text-neon-cyan flex items-center gap-1"><Edit2 className="h-3 w-3"/>Add note</button>{noteForToday && <span className="text-xs text-muted-foreground">📝 {noteForToday.slice(0,40)}</span>}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>

        {/* Weekly AI Review */}
        <GlassCard className="p-5"><div className="flex justify-between items-center mb-3"><h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4"/>Weekly AI Review</h3></div><p className="text-sm">{weeklyReview}</p></GlassCard>

        {/* Goal Linking */}
        {goals.length > 0 && <GlassCard className="p-5"><h3 className="font-semibold mb-2 flex items-center gap-2"><Target className="h-4 w-4"/>Linked Goal</h3><select className="glass rounded-lg px-3 py-2 text-sm w-full" defaultValue=""><option disabled>Link habits to a goal</option>{goals.map(g=><option key={g.id}>{g.title}</option>)}</select></GlassCard>}

        {/* Habit Templates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{TEMPLATES.map((tmpl,i)=> <GlassCard key={i} className="p-3 cursor-pointer hover:scale-105 transition" onClick={()=>addTemplate(tmpl)}><p className="font-medium">{tmpl.name}</p><p className="text-xs text-muted-foreground">{tmpl.habits.join(", ")}</p></GlassCard>)}</div>

        {/* Quick Add */}
        <form onSubmit={(e)=>{e.preventDefault(); const name=(e.target as HTMLFormElement).habitName.value; if(!name) return; addHabit({name, emoji:"➕", color:COLORS[habits.length%COLORS.length], category:"personal", difficulty:"medium"}); (e.target as HTMLFormElement).reset();}} className="glass p-4 rounded-xl flex gap-2"><input name="habitName" placeholder="New habit name" className="flex-1 bg-transparent outline-none text-sm"/><button type="submit" className="bg-gradient-primary px-4 py-2 rounded-lg text-xs">+ Add</button></form>

        {/* Habit Details Drawer */}
        <AnimatePresence>{drawerHabit && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={()=>setDrawerHabit(null)}><motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="w-full max-w-md glass h-full overflow-y-auto p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{drawerHabit.emoji} {drawerHabit.name}</h2><button onClick={()=>setDrawerHabit(null)}><X className="h-5 w-5"/></button></div><div className="space-y-4"><div><span className="text-muted-foreground">🔥 Streak:</span> {getStreak(drawerHabit.history, today)} days</div><div><span className="text-muted-foreground">📈 Consistency:</span> {Math.round(getCompletionRate(drawerHabit.history, last30Days))}%</div><div><span className="text-muted-foreground">⏰ Best time:</span> {getBestTime(drawerHabit)}</div><div><span className="text-muted-foreground">🏆 Longest streak:</span> {getLongestStreak(drawerHabit.history)} days</div><div><span className="text-muted-foreground">🎯 Score:</span> {getHabitScore(drawerHabit, today, last30Days)}/100</div><div><span className="text-muted-foreground">🔮 Prediction:</span> {getPrediction(drawerHabit, today)}% chance today</div><div className="border-t pt-2"><h4 className="font-semibold">Notes</h4>{drawerHabit.notes && Object.entries(drawerHabit.notes).slice(-3).map(([date,note])=><p key={date} className="text-xs"><strong>{date}:</strong> {note}</p>)}{(!drawerHabit.notes || Object.keys(drawerHabit.notes).length===0) && <p className="text-xs">No notes yet.</p>}</div></div></motion.div></div>)}</AnimatePresence>

        {/* AI Habit Builder Modal */}
        <AnimatePresence>{showBuilder && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowBuilder(false)}><div className="glass p-6 rounded-xl max-w-md w-full" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h3 className="font-bold">AI Habit Builder</h3><button onClick={()=>setShowBuilder(false)}><X className="h-5 w-5"/></button></div>{builderStep===0 && <><p className="text-sm mb-2">What do you want to achieve?</p><input autoFocus value={builderGoal} onChange={e=>setBuilderGoal(e.target.value)} className="glass w-full rounded-lg p-2 text-sm" placeholder="e.g., Become better at DSA" /></>}{builderStep===1 && <><p className="text-sm mb-2">Duration?</p><select value={builderDuration} onChange={e=>setBuilderDuration(e.target.value)} className="glass w-full rounded-lg p-2 text-sm"><option value="">Select</option><option>1 month</option><option>3 months</option><option>6 months</option></select></>}{builderStep===2 && <><p className="text-sm mb-2">Available time per day?</p><select value={builderTime} onChange={e=>setBuilderTime(e.target.value)} className="glass w-full rounded-lg p-2 text-sm"><option value="">Select</option><option>30 min</option><option>1 hour</option><option>2 hours</option><option>3+ hours</option></select></>}<div className="flex justify-end gap-2 mt-4">{builderStep>0 && <button onClick={()=>setBuilderStep(prev=>prev-1)} className="px-3 py-1 text-sm">Back</button>}<button onClick={handleBuilderNext} className="bg-gradient-primary px-4 py-1 rounded-lg text-sm">{builderStep===2?'Generate':'Next'}</button></div></div></div>)}</AnimatePresence>

        {/* Notes Modal */}
        <AnimatePresence>{editingNote && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setEditingNote(null)}><div className="glass p-5 rounded-xl max-w-md w-full" onClick={e=>e.stopPropagation()}><h3 className="font-bold mb-2">Reflection for {editingNote.date}</h3><textarea value={editingNote.text} onChange={e=>setEditingNote({...editingNote, text:e.target.value})} rows={3} className="glass w-full rounded-lg p-2 text-sm" placeholder="How did it go?" /><div className="flex justify-end gap-2 mt-3"><button onClick={()=>setEditingNote(null)}>Cancel</button><button onClick={()=>{addHabitNote(editingNote.habitId, editingNote.date, editingNote.text); setEditingNote(null);}} className="bg-neon-cyan/20 px-3 py-1 rounded-lg">Save</button></div></div></div>)}</AnimatePresence>
      </div>
    </AppShell>
  );
}