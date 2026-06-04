import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Habit, type HabitCategory, type HabitDifficulty } from "@/lib/store";
import { formatLocalDate, startOfLocalDay } from "@/lib/date";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import {
  Flame, TrendingUp, Award, Brain, Lightbulb, BarChart3, ListChecks,
  X, Edit2, ChevronDown, ChevronRight, CheckCircle, Circle,
  Target, Clock, Save, Trash2, MessageCircle, Send, RotateCcw, Plus, CalendarDays,
  Sparkles, Check, AlertTriangle, TrendingDown, Zap, Calendar, Link2
} from "lucide-react";
import { askAssistant } from "@/lib/api/assistant.functions";

export const Route = createFileRoute("/habits")({ component: HabitsPage });

// ---------- Constants ----------
const COLORS = ["neon-purple", "neon-blue", "neon-cyan", "neon-pink"];
const CATEGORIES: HabitCategory[] = ["health", "learning", "career", "fitness", "spiritual", "personal"];
const DIFFICULTIES: HabitDifficulty[] = ["easy", "medium", "hard"];

// ---------- Helper Functions ----------
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

// Health score: 0-100 based on streak (40%), completion rate over last 30 days (40%), weekly consistency (20%)
function getHealthScore(habit: Habit, todayStr: string, last30Days: string[], last7Days: string[]): number {
  const streak = getStreak(habit.history, todayStr);
  const rate30 = getCompletionRate(habit.history, last30Days);
  const rate7 = getCompletionRate(habit.history, last7Days);
  const streakScore = Math.min(100, streak * 4); // 25 days = 100
  const score = (streakScore * 0.4) + (rate30 * 0.4) + (rate7 * 0.2);
  return Math.round(Math.min(100, score));
}

// Risk prediction: probability of missing today based on last 7 days
function getRiskPrediction(habit: Habit, todayStr: string): { risk: number; reason: string; recommendation: string } {
  const last7 = [...Array(7)].map((_, i) => formatLocalDate(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const misses = last7.filter(d => !habit.history[d]).length;
  let risk = Math.round((misses / 7) * 100);
  let reason = "";
  let recommendation = "";
  if (risk > 70) {
    reason = `Missed ${misses} of last 7 days`;
    recommendation = "Try moving this habit to your most productive time of day.";
  } else if (risk > 40) {
    reason = `Inconsistent lately`;
    recommendation = "Set a specific reminder or link this habit to an existing routine.";
  } else {
    reason = `Consistent performer`;
    recommendation = "Keep it up! You're building momentum.";
  }
  return { risk, reason, recommendation };
}

// ---------- Components ----------
function ProgressRing({ progress, size = 80, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
      <motion.circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="url(#gradient)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.6 }} />
      <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient></defs>
    </svg>
  );
}

// Expandable Habit Card
function HabitCard({ habit, onToggle, onEdit, onDelete, onViewDetails, today, last30Days, last7Days }: any) {
  const [expanded, setExpanded] = useState(false);
  const streak = getStreak(habit.history, today);
  const healthScore = getHealthScore(habit, today, last30Days, last7Days);
  const { risk, reason, recommendation } = getRiskPrediction(habit, today);
  const targetProgress = habit.targetDays ? (streak / habit.targetDays) * 100 : 0;
  const daysLeft = habit.targetDays ? Math.max(0, habit.targetDays - streak) : null;
  const noteForToday = habit.notes?.[today] || "";

  return (
    <GlassCard className="!p-0 overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-white/5 transition" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{habit.emoji}</span>
            <div>
              <div className="font-semibold text-lg">{habit.name}</div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400"/> {streak} days</span>
                <span className="flex items-center gap-1"><Award className="h-3 w-3 text-yellow-400"/> {healthScore}/100</span>
                {habit.targetDays && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-neon-cyan"/> {daysLeft} days left</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="rounded-full p-1">
              {habit.history[today] ? <CheckCircle className="h-6 w-6 text-neon-cyan"/> : <Circle className="h-6 w-6 text-white/40"/>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-muted-foreground hover:text-neon-cyan"><Edit2 className="h-4 w-4"/></button>
            {expanded ? <ChevronDown className="h-5 w-5"/> : <ChevronRight className="h-5 w-5"/>}
          </div>
        </div>

        {/* Collapsed extra info: health score bar */}
        <div className="mt-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple" initial={{ width: 0 }} animate={{ width: `${healthScore}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{height:0}} animate={{height:"auto"}} exit={{height:0}} className="border-t border-white/10 p-4 space-y-4">
            {/* Target progress */}
            {habit.targetDays && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span>Challenge Progress</span><span>{streak} / {habit.targetDays} days</span></div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple" animate={{ width: `${targetProgress}%` }} />
                </div>
              </div>
            )}

            {/* Risk prediction */}
            {risk > 40 && (
              <div className="glass p-3 rounded-lg bg-neon-pink/10 border border-neon-pink/20">
                <div className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-yellow-400"/> Risk of breaking streak: {risk}%</div>
                <p className="text-xs mt-1">⚠️ {reason}</p>
                <p className="text-xs text-neon-cyan mt-1">💡 {recommendation}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="glass px-2 py-1 rounded-full">{habit.category}</span>
              <span className="glass px-2 py-1 rounded-full">{habit.difficulty}</span>
              <button onClick={() => onViewDetails()} className="text-neon-cyan underline">Full Details</button>
              <button onClick={() => onDelete()} className="text-red-400 underline">Delete</button>
            </div>

            {/* Note input */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => {}} className="text-xs text-neon-cyan flex items-center gap-1"><Edit2 className="h-3 w-3"/> Add reflection</button>
              {noteForToday && <span className="text-xs text-muted-foreground truncate max-w-[200px]">📝 {noteForToday}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// Edit Habit Modal
function EditHabitModal({ habit, onClose, onSave }: { habit: Habit; onClose: () => void; onSave: (updated: Partial<Habit>) => void }) {
  const [name, setName] = useState(habit.name);
  const [emoji, setEmoji] = useState(habit.emoji);
  const [category, setCategory] = useState<HabitCategory>(habit.category || "personal");
  const [difficulty, setDifficulty] = useState<HabitDifficulty>(habit.difficulty || "medium");
  const [targetDays, setTargetDays] = useState(habit.targetDays || 0);
  const [dueDate, setDueDate] = useState(habit.dueDate || "");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass p-6 rounded-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Edit Habit</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Name</label><input value={name} onChange={e=>setName(e.target.value)} className="glass w-full rounded-lg p-2 text-sm" /></div>
          <div><label className="text-xs text-muted-foreground">Emoji</label><input value={emoji} onChange={e=>setEmoji(e.target.value)} className="glass w-full rounded-lg p-2 text-sm" /></div>
          <div><label className="text-xs text-muted-foreground">Category</label><select value={category} onChange={e=>setCategory(e.target.value as HabitCategory)} className="glass w-full rounded-lg p-2 text-sm">{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-muted-foreground">Difficulty</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value as HabitDifficulty)} className="glass w-full rounded-lg p-2 text-sm">{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label className="text-xs text-muted-foreground">Target Days (0 = no target)</label><input type="number" value={targetDays} onChange={e=>setTargetDays(Number(e.target.value))} className="glass w-full rounded-lg p-2 text-sm" placeholder="e.g., 30 for a challenge" /></div>
          <div><label className="text-xs text-muted-foreground">Due Date (optional)</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="glass w-full rounded-lg p-2 text-sm" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm">Cancel</button>
          <button onClick={() => { onSave({ name, emoji, category, difficulty, targetDays: targetDays || undefined, dueDate: dueDate || undefined }); onClose(); }} className="bg-gradient-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Save className="h-4 w-4"/> Save</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Page ----------
function HabitsPage() {
  const { habits, addHabit, deleteHabit, toggleHabit, updateHabit, addHabitNote } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerHabit, setDrawerHabit] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Habit>[]>([]);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string, intent?: string, data?: any }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [editingNote, setEditingNote] = useState<{ habitId: string; date: string; text: string } | null>(null);

  const today = formatLocalDate(new Date());
  const last30Days = [...Array(30)].map((_, i) => formatLocalDate(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const last7Days = last30Days.slice(0, 7);

  // Stats
  const currentStreak = Math.max(...habits.map(h => getStreak(h.history, today)), 0);
  const totalHabits = habits.length;
  const completedToday = habits.filter(h => h.history[today]).length;
  const completionRate = totalHabits ? Math.round((completedToday / totalHabits) * 100) : 0;
  const remainingHabits = habits.filter(h => !h.history[today]);

  // Weekly Insights
  const weeklyInsights = useMemo(() => {
    if (habits.length === 0) return null;
    // Most consistent (highest health score)
    const healthScores = habits.map(h => ({ habit: h, score: getHealthScore(h, today, last30Days, last7Days) }));
    const mostConsistent = [...healthScores].sort((a,b) => b.score - a.score)[0];
    // Most improved (largest increase in weekly completion vs previous week)
    const lastWeek = last30Days.slice(0,7);
    const prevWeek = last30Days.slice(7,14);
    const improvements = habits.map(h => ({
      habit: h,
      improvement: getCompletionRate(h.history, lastWeek) - getCompletionRate(h.history, prevWeek)
    }));
    const mostImproved = [...improvements].sort((a,b) => b.improvement - a.improvement)[0];
    // Needs attention (lowest health score)
    const needsAttention = [...healthScores].sort((a,b) => a.score - b.score)[0];
    // Productivity trend (average completion rate change)
    const avgLastWeek = habits.reduce((acc,h) => acc + getCompletionRate(h.history, lastWeek), 0) / habits.length;
    const avgPrevWeek = habits.reduce((acc,h) => acc + getCompletionRate(h.history, prevWeek), 0) / habits.length;
    const trend = Math.round(avgLastWeek - avgPrevWeek);
    return { mostConsistent, mostImproved, needsAttention, trend };
  }, [habits, today, last30Days, last7Days]);

  // AI Habit Builder - generates 3 suggestions
  const generateHabitSuggestions = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const response = await askAssistant({
        data: {
          message: `The user wants to create a new habit: "${aiPrompt}". Generate 3 different habit suggestions in JSON array format. Each object should have: name (short, catchy), emoji (one emoji), category (health/learning/career/fitness/spiritual/personal), difficulty (easy/medium/hard), targetDays (optional number), description (short, why it's effective). Return ONLY the JSON array, no extra text. Example: [{ "name": "English Fluency", "emoji": "🇬🇧", "category": "learning", "difficulty": "medium", "targetDays": 30, "description": "Daily speaking practice boosts confidence" }]`,
          context: {}
        }
      });
      let jsonStr = response.response;
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const suggestions = JSON.parse(jsonStr);
      setAiSuggestions(suggestions.slice(0, 3));
    } catch (err) {
      console.error(err);
      setAiSuggestions([{
        name: aiPrompt.slice(0, 40),
        emoji: "✨",
        category: "personal",
        difficulty: "medium",
        description: "Custom habit based on your request"
      }]);
    } finally {
      setAiGenerating(false);
    }
  };

  const addSuggestion = (sugg: Partial<Habit>) => {
    addHabit({
      name: sugg.name!,
      emoji: sugg.emoji || "📌",
      color: COLORS[habits.length % COLORS.length],
      category: sugg.category as HabitCategory || "personal",
      difficulty: sugg.difficulty as HabitDifficulty || "medium",
      targetDays: sugg.targetDays
    });
    setAiSuggestions([]);
    setAiPrompt("");
    setShowBuilder(false);
  };

  // AI Intent Handler
  const handleChatIntent = async (userMessage: string) => {
    const lower = userMessage.toLowerCase();
    // Simple intent detection first
    if (lower.includes("add habit") || lower.includes("create habit") || lower.includes("new habit")) {
      // Extract potential habit name
      let habitName = userMessage.replace(/add habit|create habit|new habit|please/gi, "").trim();
      if (habitName.length < 2) habitName = "New habit";
      // Ask AI to refine
      try {
        const response = await askAssistant({
          data: {
            message: `The user wants to add a new habit: "${habitName}". Generate 3 habit suggestions as JSON array (same format as before).`,
            context: {}
          }
        });
        let jsonStr = response.response;
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        const suggestions = JSON.parse(jsonStr);
        setChatMessages(prev => [...prev, { role: 'ai', text: `I'll help you add a new habit. Choose one of these options:`, intent: "CREATE_HABIT", data: suggestions }]);
      } catch (err) {
        setChatMessages(prev => [...prev, { role: 'ai', text: `Tell me more about the habit you want to build, and I'll create it for you.` }]);
      }
    } else if (lower.includes("complete") || lower.includes("done") || lower.includes("finish")) {
      // Find habit name and mark it done
      const words = userMessage.split(" ");
      const possibleHabit = words.find(w => habits.some(h => h.name.toLowerCase().includes(w.toLowerCase())));
      if (possibleHabit) {
        const habit = habits.find(h => h.name.toLowerCase().includes(possibleHabit.toLowerCase()));
        if (habit) {
          toggleHabit(habit.id, today);
          setChatMessages(prev => [...prev, { role: 'ai', text: `✅ Marked "${habit.name}" as complete for today!` }]);
          return;
        }
      }
      setChatMessages(prev => [...prev, { role: 'ai', text: `Which habit did you complete? Please tell me the name.` }]);
    } else if (lower.includes("delete") || lower.includes("remove")) {
      const words = userMessage.split(" ");
      const possibleHabit = words.find(w => habits.some(h => h.name.toLowerCase().includes(w.toLowerCase())));
      if (possibleHabit) {
        const habit = habits.find(h => h.name.toLowerCase().includes(possibleHabit.toLowerCase()));
        if (habit) {
          deleteHabit(habit.id);
          setChatMessages(prev => [...prev, { role: 'ai', text: `🗑️ Removed "${habit.name}" from your habits.` }]);
          return;
        }
      }
      setChatMessages(prev => [...prev, { role: 'ai', text: `Which habit would you like to delete? Tell me the name.` }]);
    } else {
      // General advice
      try {
        const response = await askAssistant({
          data: {
            message: `You are a friendly, concise habit coach. The user says: "${userMessage}". Give encouraging, actionable advice (max 2 sentences).`,
            context: { habits: habits.map(h => ({ name: h.name, streak: getStreak(h.history, today) })) }
          }
        });
        setChatMessages(prev => [...prev, { role: 'ai', text: response.response }]);
      } catch (err) {
        setChatMessages(prev => [...prev, { role: 'ai', text: "Keep going! Small steps every day make big changes." }]);
      }
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    await handleChatIntent(userMsg);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const addTemplate = (tmpl: any) => {
    tmpl.habits.forEach((name: string) => {
      addHabit({
        name, emoji: "📌", color: COLORS[habits.length % COLORS.length],
        category: tmpl.category, difficulty: tmpl.difficulty,
        targetDays: tmpl.targetDays
      });
    });
  };

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="p-5 flex items-center gap-4"><Flame className="h-8 w-8 text-orange-400"/><div><p className="text-3xl font-bold">{currentStreak}</p><p className="text-xs text-muted-foreground">Day Streak</p></div></GlassCard>
          <GlassCard className="p-5 flex items-center gap-4"><ListChecks className="h-8 w-8 text-neon-cyan"/><div><p className="text-3xl font-bold">{completedToday}/{totalHabits}</p><p className="text-xs text-muted-foreground">Done Today</p></div></GlassCard>
          <GlassCard className="p-5 flex items-center gap-4"><TrendingUp className="h-8 w-8 text-green-400"/><div><p className="text-3xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Completion Rate</p></div></GlassCard>
          <GlassCard className="p-5 flex items-center gap-4"><Award className="h-8 w-8 text-yellow-400"/><div><p className="text-3xl font-bold">{habits.length}</p><p className="text-xs text-muted-foreground">Active Habits</p></div></GlassCard>
        </div>

        {/* Today's Mission - AI Generated */}
        <GlassCard className="p-6 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20 border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-400"/> Today's Mission</h2>
              <p className="text-sm mt-1">{remainingHabits.length} habit{remainingHabits.length !== 1 ? 's' : ''} remaining</p>
              {remainingHabits.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Priority habits:</p>
                  {remainingHabits.slice(0, 2).map(h => (
                    <div key={h.id} className="flex items-center gap-2 text-sm"><span className="text-lg">{h.emoji}</span> {h.name} <span className="text-xs text-muted-foreground">({h.targetDays ? `${getStreak(h.history, today)}/${h.targetDays} days` : ''})</span></div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">⏱️ Estimated focus: {Math.ceil(remainingHabits.length * 25)} min</p>
            </div>
            <div className="relative">
              <ProgressRing progress={completionRate} size={80} strokeWidth={6} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{completionRate}%</span>
            </div>
          </div>
        </GlassCard>

        {/* Weekly Insights Dashboard */}
        {weeklyInsights && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <GlassCard className="p-3"><div className="text-xs text-muted-foreground">🏆 Most consistent</div><div className="font-semibold">{weeklyInsights.mostConsistent.habit.emoji} {weeklyInsights.mostConsistent.habit.name}</div><div className="text-xs">Score: {weeklyInsights.mostConsistent.score}/100</div></GlassCard>
            <GlassCard className="p-3"><div className="text-xs text-muted-foreground">📈 Most improved</div><div className="font-semibold">{weeklyInsights.mostImproved.habit.emoji} {weeklyInsights.mostImproved.habit.name}</div><div className="text-xs">{weeklyInsights.mostImproved.improvement > 0 ? `+${weeklyInsights.mostImproved.improvement}%` : `${weeklyInsights.mostImproved.improvement}%`}</div></GlassCard>
            <GlassCard className="p-3"><div className="text-xs text-muted-foreground">⚠️ Needs attention</div><div className="font-semibold">{weeklyInsights.needsAttention.habit.emoji} {weeklyInsights.needsAttention.habit.name}</div><div className="text-xs">Score: {weeklyInsights.needsAttention.score}/100</div></GlassCard>
            <GlassCard className="p-3"><div className="text-xs text-muted-foreground">📊 Productivity trend</div><div className="font-semibold">{weeklyInsights.trend > 0 ? `+${weeklyInsights.trend}%` : `${weeklyInsights.trend}%`}</div><div className="text-xs">vs last week</div></GlassCard>
          </div>
        )}

        {/* AI Coach Insights */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3"><Brain className="h-5 w-5 text-neon-cyan" /> AI Coach</div>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><Lightbulb className="h-4 w-4 mt-0.5 text-yellow-400"/> Your current streak leader: {habits.reduce((best, h) => getStreak(h.history, today) > getStreak(best?.history || {}, today) ? h : best, null as Habit | null)?.name || "None"} with {Math.max(...habits.map(h=>getStreak(h.history,today)))} days.</li>
            <li className="flex gap-2"><Lightbulb className="h-4 w-4 mt-0.5 text-yellow-400"/> You have {habits.filter(h=>getHealthScore(h,today,last30Days,last7Days)<40).length} habit{habits.filter(h=>getHealthScore(h,today,last30Days,last7Days)<40).length!==1?'s':''} that could use more attention.</li>
          </ul>
        </GlassCard>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button onClick={()=>setShowBuilder(true)} className="glass px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition"><Plus className="h-4 w-4"/> AI Habit Builder</button>
          <button onClick={()=>setAiChatOpen(true)} className="glass px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition"><MessageCircle className="h-4 w-4"/> AI Assistant</button>
        </div>

        {/* Habit Cards */}
        <div className="space-y-3">
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onToggle={() => toggleHabit(habit.id, today)}
              onEdit={() => setEditingHabit(habit)}
              onDelete={() => deleteHabit(habit.id)}
              onViewDetails={() => setDrawerHabit(habit)}
              today={today}
              last30Days={last30Days}
              last7Days={last7Days}
            />
          ))}
          {habits.length === 0 && (
            <GlassCard className="p-12 text-center">
              <p className="text-muted-foreground">No habits yet. Use the AI Builder or Assistant to create your first habit.</p>
            </GlassCard>
          )}
        </div>

        {/* Smart Templates */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Quick Start Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <GlassCard className="p-3 cursor-pointer hover:scale-105 transition" onClick={() => addTemplate({ name: "Placement Prep", habits: ["DSA Practice", "Aptitude Test", "CS Fundamentals"], category: "learning", difficulty: "hard", targetDays: 60 })}>
              <p className="font-medium">🎯 Placement Prep</p>
              <p className="text-xs text-muted-foreground">DSA, Aptitude, CS Fundamentals</p>
            </GlassCard>
            <GlassCard className="p-3 cursor-pointer hover:scale-105 transition" onClick={() => addTemplate({ name: "Fitness", habits: ["Morning Workout", "Drink 3L Water", "Sleep 8h"], category: "fitness", difficulty: "medium", targetDays: 30 })}>
              <p className="font-medium">🏋️ Fitness</p>
              <p className="text-xs text-muted-foreground">Workout, Hydration, Sleep</p>
            </GlassCard>
            <GlassCard className="p-3 cursor-pointer hover:scale-105 transition" onClick={() => addTemplate({ name: "Study Mode", habits: ["Revision", "Practice Problems", "Reading"], category: "learning", difficulty: "medium", targetDays: 45 })}>
              <p className="font-medium">📚 Study Mode</p>
              <p className="text-xs text-muted-foreground">Revision, Practice, Reading</p>
            </GlassCard>
          </div>
        </div>

        {/* Roadmap Integration */}
        <GlassCard className="p-5 cursor-pointer hover:bg-white/5 transition" onClick={() => {
          // In a real app, open a modal to paste playlist/goal
          alert("Roadmap integration: paste a YouTube playlist URL or describe a goal, and AI will generate a daily habit plan with target days.");
        }}>
          <div className="flex items-center gap-3"><Link2 className="h-5 w-5 text-neon-cyan"/> <span className="font-medium">Generate habits from a roadmap</span></div>
          <p className="text-xs text-muted-foreground mt-1">Paste a YouTube playlist or describe a learning goal → AI creates a daily habit plan</p>
        </GlassCard>

        {/* Quick Add */}
        <form onSubmit={(e)=>{e.preventDefault(); const name=(e.target as HTMLFormElement).habitName.value; if(!name) return; addHabit({name, emoji:"➕", color:COLORS[habits.length%COLORS.length], category:"personal", difficulty:"medium"}); (e.target as HTMLFormElement).reset();}} className="glass p-4 rounded-xl flex gap-2">
          <input name="habitName" placeholder="Quick habit name..." className="flex-1 bg-transparent outline-none text-sm" />
          <button type="submit" className="bg-gradient-primary px-4 py-2 rounded-lg text-xs">+ Add</button>
        </form>

        {/* Modals */}
        {editingHabit && <EditHabitModal habit={editingHabit} onClose={()=>setEditingHabit(null)} onSave={(updated)=>updateHabit(editingHabit.id, updated)} />}

        {/* Habit Details Drawer */}
        <AnimatePresence>
          {drawerHabit && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={()=>setDrawerHabit(null)}>
              <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="w-full max-w-md glass h-full overflow-y-auto p-5" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{drawerHabit.emoji} {drawerHabit.name}</h2><button onClick={()=>setDrawerHabit(null)}><X className="h-5 w-5"/></button></div>
                <div className="space-y-4">
                  <div><span className="text-muted-foreground">🔥 Current Streak:</span> {getStreak(drawerHabit.history, today)} days</div>
                  <div><span className="text-muted-foreground">📈 Consistency (30d):</span> {Math.round(getCompletionRate(drawerHabit.history, last30Days))}%</div>
                  <div><span className="text-muted-foreground">❤️ Health Score:</span> {getHealthScore(drawerHabit, today, last30Days, last7Days)}/100</div>
                  {drawerHabit.targetDays && <div><span className="text-muted-foreground">🎯 Target:</span> {drawerHabit.targetDays} days</div>}
                  <div className="border-t pt-2"><h4 className="font-semibold">Notes</h4>{drawerHabit.notes && Object.entries(drawerHabit.notes).slice(-5).map(([date,note])=><p key={date} className="text-xs mt-1"><strong>{date}:</strong> {note}</p>)}{(!drawerHabit.notes || Object.keys(drawerHabit.notes).length===0) && <p className="text-xs">No notes yet.</p>}</div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Habit Builder Modal (with 3 suggestions) */}
        <AnimatePresence>
          {showBuilder && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>{setShowBuilder(false); setAiSuggestions([]);}}>
              <div className="glass p-6 rounded-xl max-w-md w-full" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">AI Habit Builder</h3><button onClick={()=>{setShowBuilder(false); setAiSuggestions([]);}}><X className="h-5 w-5"/></button></div>
                <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} rows={3} className="glass w-full rounded-lg p-3 text-sm" placeholder="Describe what you want to achieve...&#10;e.g., 'Learn English 30 min daily'" />
                <button onClick={generateHabitSuggestions} disabled={aiGenerating} className="mt-3 w-full bg-gradient-primary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  {aiGenerating ? <><RotateCcw className="h-4 w-4 animate-spin"/> Generating...</> : "Generate Habit Suggestions"}
                </button>
                {aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium">Choose a habit:</p>
                    {aiSuggestions.map((sugg, idx) => (
                      <div key={idx} className="glass p-3 rounded-lg cursor-pointer hover:bg-white/10 transition" onClick={() => addSuggestion(sugg)}>
                        <div className="flex items-center gap-2"><span className="text-2xl">{sugg.emoji}</span><span className="font-semibold">{sugg.name}</span><span className="text-xs text-muted-foreground">({sugg.difficulty})</span></div>
                        <p className="text-xs mt-1">{sugg.description}</p>
                        {sugg.targetDays && <p className="text-xs text-neon-cyan mt-1">🎯 {sugg.targetDays} day challenge</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Chat Modal */}
        <AnimatePresence>
          {aiChatOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setAiChatOpen(false)}>
              <div className="glass rounded-xl w-full max-w-md h-[500px] flex flex-col" onClick={e=>e.stopPropagation()}>
                <div className="p-3 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold">AI Habit Coach</h3><button onClick={()=>setAiChatOpen(false)}><X className="h-5 w-5"/></button></div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((msg,idx)=>(
                    <div key={idx} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role==='user'?'bg-neon-cyan/20 text-white':'bg-white/10'}`}>{msg.text}</div>
                    </div>
                  ))}
                  {chatMessages.length===0 && <p className="text-center text-muted-foreground text-sm">Say "add a habit to meditate daily" or "complete workout" or "delete reading habit".</p>}
                </div>
                {/* If the last message contains habit suggestions, show buttons */}
                {chatMessages.length > 0 && chatMessages[chatMessages.length-1].intent === "CREATE_HABIT" && chatMessages[chatMessages.length-1].data && (
                  <div className="p-3 border-t border-white/10 space-y-2">
                    <p className="text-xs">Choose a habit:</p>
                    {chatMessages[chatMessages.length-1].data.map((sugg: any, i: number) => (
                      <button key={i} onClick={() => { addHabit({ name: sugg.name, emoji: sugg.emoji, color: COLORS[habits.length % COLORS.length], category: sugg.category, difficulty: sugg.difficulty, targetDays: sugg.targetDays }); setChatMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: `✅ Added "${sugg.name}" to your habits!` }]); }} className="w-full glass p-2 rounded-lg text-sm text-left flex items-center gap-2"><span className="text-xl">{sugg.emoji}</span> {sugg.name}</button>
                    ))}
                  </div>
                )}
                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendChatMessage()} className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none" placeholder="e.g., add a habit to learn English" />
                  <button onClick={sendChatMessage} className="bg-gradient-primary px-3 py-2 rounded-lg"><Send className="h-4 w-4"/></button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Notes Modal */}
        <AnimatePresence>
          {editingNote && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setEditingNote(null)}>
              <div className="glass p-5 rounded-xl max-w-md w-full" onClick={e=>e.stopPropagation()}>
                <h3 className="font-bold mb-2">Reflection for {editingNote.date}</h3>
                <textarea value={editingNote.text} onChange={e=>setEditingNote({...editingNote, text:e.target.value})} rows={3} className="glass w-full rounded-lg p-2 text-sm" placeholder="How did it go? Any challenges?" />
                <div className="flex justify-end gap-2 mt-3"><button onClick={()=>setEditingNote(null)}>Cancel</button><button onClick={()=>{addHabitNote(editingNote.habitId, editingNote.date, editingNote.text); setEditingNote(null);}} className="bg-neon-cyan/20 px-3 py-1 rounded-lg">Save</button></div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}