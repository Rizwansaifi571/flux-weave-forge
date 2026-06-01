import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AiCommandPanel } from "@/components/AiCommandPanel";
import { AiQuickActions } from "@/components/AiQuickActions";
import { AiCoachCard } from "@/components/AiCoachCard";
import { PlanConfirmation, type GeneratedPlan } from "@/components/PlanConfirmation";
import { useStore, type Priority, type Task } from "@/lib/store";
import { parseCommand, QUICK_ACTION_PROMPTS } from "@/lib/ai-utils";
import { analyzeProductivity } from "@/lib/ai/task-analyzer";
import { generateCoachInsight } from "@/lib/ai/task-coach";
import { generateTaskPlan, buildTaskDrafts } from "@/lib/ai/task-planner";
import { planDay } from "@/lib/ai/task-scheduler";
import { prioritizeTasks } from "@/lib/ai/task-prioritizer";
import type { AiContext } from "@/lib/ai/ai-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  Flame,
  Clock,
  Sparkles,
  AlertCircle,
  List,
  Columns,
  Zap,
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

// ---------- Constants ----------
const todayStr = new Date().toISOString().slice(0, 10);
const priorityConfig = {
  high: { color: "bg-neon-pink", label: "High", icon: AlertCircle },
  medium: { color: "bg-neon-purple", label: "Medium", icon: Circle },
  low: { color: "bg-neon-blue", label: "Low", icon: Circle },
} as const;

type ViewMode = "list" | "board";
type FilterType = "all" | "today" | "pending" | "done" | "high";
type GroupBy = "category" | "dueDate" | "priority";
type EnergyLevel = "low" | "medium" | "high";
type TaskInput = Omit<Task, "id" | "createdAt" | "completed">;

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Helper Components ----------

function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="url(#gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WeeklyChart({ completedByDay }: { completedByDay: number[] }) {
  const max = Math.max(...completedByDay, 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex items-end gap-1 h-16">
      {completedByDay.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <motion.div
            className="w-full rounded-t bg-gradient-to-t from-neon-purple to-neon-cyan"
            initial={{ height: 0 }}
            animate={{ height: `${(val / max) * 100}%` }}
            style={{ minHeight: val > 0 ? "4px" : "0" }}
          />
          <span className="text-[9px] mt-1 text-muted-foreground">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

function QuickAddForm({ onClose }: { onClose: () => void }) {
  const { addTask } = useStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [energy, setEnergy] = useState<EnergyLevel>("medium");
  const [dueDate, setDueDate] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(30);
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      priority,
      energy,
      focusMinutes: Math.min(480, Math.max(5, focusMinutes || 30)),
      category: category.trim() || "General",
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      dueDate: dueDate || undefined,
    });
    setTitle("");
    setPriority("medium");
    setEnergy("medium");
    setDueDate("");
    setFocusMinutes(30);
    onClose();
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="space-y-3 overflow-hidden"
    >
      <div className="flex gap-2 items-center">
        <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary glow-soft">
          <Plus className="h-4 w-4 text-white" />
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's your mission?"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground font-medium"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-medium text-white glow-soft hover:opacity-90 transition"
        >
          Add
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <select
          value={energy}
          onChange={(e) => setEnergy(e.target.value as EnergyLevel)}
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        >
          <option value="low">Low Energy</option>
          <option value="medium">Medium Energy</option>
          <option value="high">High Energy</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (csv)"
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        />
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <input
            type="number"
            min={5}
            max={480}
            value={focusMinutes}
            onChange={(e) => setFocusMinutes(Number(e.target.value))}
            className="glass w-16 rounded-lg px-2 py-1.5 text-xs outline-none"
          />
          <span className="text-[10px] text-muted-foreground">min</span>
        </div>
      </div>
    </motion.form>
  );
}

function TaskCard({
  task,
  onToggle,
  onDelete,
  onEdit,
  compact = false,
}: {
  task: Task & { energy?: EnergyLevel };
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  compact?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01 }}
      className={`group glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition ${task.completed ? "opacity-70" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        onEdit();
      }}
    >
      <button onClick={onToggle} className="shrink-0">
        {task.completed ? (
          <CheckCircle2 className="h-5 w-5 text-neon-cyan" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-neon-purple transition" />
        )}
      </button>
      <div className={`h-8 w-1 rounded-full ${priorityConfig[task.priority].color}`} />
      <div className="flex-1 min-w-0">
        <div
          className={`font-medium text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}
        >
          {task.title}
        </div>
        {!compact && (
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            {task.energy && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> {task.energy}
              </span>
            )}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ${task.dueDate < todayStr && !task.completed ? "text-neon-pink" : ""}`}
              >
                <Calendar className="h-3 w-3" /> {task.dueDate}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {task.focusMinutes}m
            </span>
            {task.tags?.slice(0, 2).map((t) => (
              <span key={t} className="glass px-1.5 py-0.5 rounded-full text-[10px]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-neon-pink">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ---------- Main Page ----------
function TasksPage() {
  const {
    tasks,
    habits,
    goals,
    lifeContext,
    focusSessions,
    playlistImports,
    assistantMessages,
    batchAddTasks,
    toggleTask,
    deleteTask,
    updateTask,
    addAssistantMessage,
    streakCount,
    userName,
  } = useStore();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // AI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<TaskInput[]>([]);
  const [coachData, setCoachData] = useState<{
    mostProductiveHour: string;
    weakArea: string;
    suggestion: string;
  } | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const autoRescheduleRef = useRef<string | null>(null);
  const coachSignatureRef = useRef<string | null>(null);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const todayTasks = tasks.filter((t) => t.dueDate === todayStr);
    const completedToday = todayTasks.filter((t) => t.completed).length;
    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && !t.completed).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const streak =
      streakCount ??
      (() => {
        let s = 0;
        const dates = new Set(tasks.filter((t) => t.completed && t.dueDate).map((t) => t.dueDate));
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        while (dates.has(d.toISOString().slice(0, 10))) {
          s++;
          d.setDate(d.getDate() - 1);
        }
        return s;
      })();
    const weekly = new Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toISOString().slice(0, 10);
      weekly[i] = tasks.filter((t) => t.completed && t.dueDate === ds).length;
    }
    return {
      total,
      completed,
      pending,
      completedToday,
      todayTotal: todayTasks.length,
      overdue,
      completionRate,
      streak,
      weekly,
    };
  }, [tasks, streakCount]);

  const insight = useMemo(() => {
    if (coachData?.suggestion) return coachData.suggestion;
    if (stats.overdue > 3)
      return "You have multiple overdue tasks. Focus on the oldest first to regain momentum.";
    if (stats.completionRate >= 80)
      return "You're crushing it! Keep the momentum by tackling high-energy tasks in the morning.";
    if (stats.streak >= 5) return `${stats.streak}-day streak! Consistency is your superpower.`;
    return "Start with a quick win to build momentum.";
  }, [coachData?.suggestion, stats]);

  const focusToday = useMemo(() => {
    return focusSessions.find((session) => session.date === todayStr)?.minutes ?? 0;
  }, [focusSessions]);

  const commandContext = useMemo<AiContext>(
    () => ({
      userName,
      today: todayStr,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        category: task.category,
        completed: task.completed,
      })),
      habits: habits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        doneToday: Boolean(habit.history[todayStr]),
      })),
      focusToday,
      streakCount: stats.streak,
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        deadline: goal.deadline,
        category: goal.category,
        status: goal.status,
      })),
      lifeContext: {
        collegeTimetable: lifeContext.collegeTimetable.map((entry) => ({
          day: entry.day,
          start: entry.start,
          end: entry.end,
          label: entry.label,
        })),
        exams: lifeContext.exams.map((exam) => ({
          title: exam.title,
          date: exam.date,
          course: exam.course,
        })),
        internships: lifeContext.internships.map((internship) => ({
          company: internship.company,
          role: internship.role,
          startDate: internship.startDate,
          endDate: internship.endDate,
          status: internship.status,
        })),
        sleepSchedule: lifeContext.sleepSchedule,
        preferredStudyHours: lifeContext.preferredStudyHours,
        placementGoals: lifeContext.placementGoals,
      },
      recentMessages: assistantMessages.slice(-12).map((message) => ({
        role: message.role,
        text: message.text,
      })),
      playlistImports: playlistImports.map((playlist) => ({
        id: playlist.id,
        title: playlist.title,
        items: playlist.items,
      })),
    }),
    [
      assistantMessages,
      focusToday,
      goals,
      habits,
      lifeContext,
      playlistImports,
      stats.streak,
      tasks,
      userName,
    ],
  );

  const coachContext = useMemo<AiContext>(
    () => ({
      userName,
      today: todayStr,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        category: task.category,
        completed: task.completed,
      })),
      habits: habits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        doneToday: Boolean(habit.history[todayStr]),
      })),
      focusToday,
      streakCount: stats.streak,
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        deadline: goal.deadline,
        category: goal.category,
        status: goal.status,
      })),
      lifeContext: {
        collegeTimetable: lifeContext.collegeTimetable.map((entry) => ({
          day: entry.day,
          start: entry.start,
          end: entry.end,
          label: entry.label,
        })),
        exams: lifeContext.exams.map((exam) => ({
          title: exam.title,
          date: exam.date,
          course: exam.course,
        })),
        internships: lifeContext.internships.map((internship) => ({
          company: internship.company,
          role: internship.role,
          startDate: internship.startDate,
          endDate: internship.endDate,
          status: internship.status,
        })),
        sleepSchedule: lifeContext.sleepSchedule,
        preferredStudyHours: lifeContext.preferredStudyHours,
        placementGoals: lifeContext.placementGoals,
      },
      recentMessages: [],
      playlistImports: playlistImports.map((playlist) => ({
        id: playlist.id,
        title: playlist.title,
        items: playlist.items,
      })),
    }),
    [focusToday, goals, habits, lifeContext, playlistImports, stats.streak, tasks, userName],
  );

  useEffect(() => {
    let cancelled = false;
    const signature = JSON.stringify({
      completed: stats.completed,
      overdue: stats.overdue,
      completionRate: stats.completionRate,
      streak: stats.streak,
      focusToday,
      pending: stats.pending,
      topTasks: tasks.slice(0, 5).map((task) => ({
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        completed: task.completed,
      })),
    });

    if (coachSignatureRef.current === signature) {
      return () => {
        cancelled = true;
      };
    }

    coachSignatureRef.current = signature;
    setIsCoachLoading(true);

    void (async () => {
      try {
        const insightData = await generateCoachInsight(coachContext);
        if (!cancelled) {
          setCoachData({
            mostProductiveHour: insightData.mostProductiveHour,
            weakArea: insightData.weakArea,
            suggestion: insightData.suggestion,
          });
        }
      } catch {
        if (!cancelled) {
          setCoachData({
            mostProductiveHour: "Morning",
            weakArea: "Task follow-through",
            suggestion:
              "Pick one high-priority task and protect a 45-minute focus block for it today.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsCoachLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    coachContext,
    focusToday,
    stats.completed,
    stats.completionRate,
    stats.overdue,
    stats.pending,
    stats.streak,
    tasks,
  ]);

  // ---------- Filtering / grouping ----------
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (
        searchQuery &&
        !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
        return false;
      switch (filter) {
        case "today":
          return task.dueDate === todayStr;
        case "pending":
          return !task.completed;
        case "done":
          return task.completed;
        case "high":
          return task.priority === "high";
        default:
          return true;
      }
    });
  }, [tasks, searchQuery, filter]);

  const { overdue, rest } = useMemo(() => {
    const overdueTasks = filteredTasks.filter(
      (t) => t.dueDate && t.dueDate < todayStr && !t.completed,
    );
    const restTasks = filteredTasks.filter((t) => !overdueTasks.includes(t));
    return { overdue: overdueTasks, rest: restTasks };
  }, [filteredTasks]);

  const groups = useMemo(() => {
    const groupsMap: Record<string, Task[]> = {};
    rest.forEach((task) => {
      let key: string;
      switch (groupBy) {
        case "dueDate":
          key = task.dueDate || "No date";
          break;
        case "priority":
          key = task.priority;
          break;
        default:
          key = task.category || "Uncategorized";
      }
      if (!groupsMap[key]) groupsMap[key] = [];
      groupsMap[key].push(task);
    });
    const sortedKeys = Object.keys(groupsMap).sort((a, b) => {
      if (groupBy === "priority") {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a] ?? 3) - (order[b] ?? 3);
      }
      if (groupBy === "dueDate") {
        if (a === "No date") return 1;
        if (b === "No date") return -1;
        return a.localeCompare(b);
      }
      return a.localeCompare(b);
    });
    return { groupsMap, sortedKeys };
  }, [rest, groupBy]);

  const boardCols = useMemo(() => {
    const cols: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      let key: string;
      switch (groupBy) {
        case "dueDate":
          key = task.dueDate || "No date";
          break;
        case "priority":
          key = task.priority;
          break;
        default:
          key = task.category || "Uncategorized";
      }
      if (!cols[key]) cols[key] = [];
      cols[key].push(task);
    });
    return cols;
  }, [filteredTasks, groupBy]);

  const rescheduleAiTasks = useCallback(
    (mode: "auto" | "manual") => {
      const today = todayStr;
      const tasksByCategory = tasks.reduce<Record<string, Task[]>>((acc, task) => {
        if (!isAiTask(task) || task.completed || !task.dueDate) return acc;
        const key = task.category || "AI Plan";
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
      }, {});

      let updated = 0;

      Object.values(tasksByCategory).forEach((categoryTasks) => {
        const hasOverdue = categoryTasks.some((task) => task.dueDate && task.dueDate < today);
        if (!hasOverdue) return;

        const dayGroups: Record<string, Task[]> = {};
        categoryTasks
          .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
          .forEach((task) => {
            const key = task.dueDate || "no-date";
            if (!dayGroups[key]) dayGroups[key] = [];
            dayGroups[key].push(task);
          });

        const sortedDates = Object.keys(dayGroups)
          .filter((d) => d !== "no-date")
          .sort();
        let cursor = new Date(`${today}T00:00:00`);

        sortedDates.forEach((dateKey) => {
          const newDate = cursor.toISOString().slice(0, 10);
          dayGroups[dateKey].forEach((task) => {
            if (task.dueDate !== newDate) {
              updateTask(task.id, { dueDate: newDate });
              updated += 1;
            }
          });
          cursor = new Date(cursor.getTime() + DAY_MS);
        });
      });

      if (updated > 0 && mode === "manual") {
        addAssistantMessage({
          role: "ai",
          text: `Rescheduled ${updated} tasks to reduce pressure. Your roadmap now starts from today.`,
        });
      }

      return updated;
    },
    [addAssistantMessage, tasks, updateTask],
  );

  useEffect(() => {
    if (autoRescheduleRef.current === todayStr) return;
    const updated = rescheduleAiTasks("auto");
    if (updated > 0) {
      autoRescheduleRef.current = todayStr;
      addAssistantMessage({
        role: "ai",
        text: "I noticed missed AI tasks and automatically adjusted your timeline to start today.",
      });
    }
  }, [addAssistantMessage, rescheduleAiTasks]);

  // ---------- AI handlers ----------
  const handleAiCommand = useCallback(
    async (command: string) => {
      setIsProcessing(true);
      addAssistantMessage({ role: "user", text: command });
      try {
        const parsed = parseCommand(command);
        if (parsed.intent === "reschedule") {
          const updated = rescheduleAiTasks("manual");
          if (updated === 0) {
            addAssistantMessage({
              role: "ai",
              text: "No overdue AI tasks found to reschedule.",
            });
          }
          return;
        }

        if (parsed.intent === "plan_day") {
          const response = await planDay(command, commandContext);
          addAssistantMessage({ role: "ai", text: response });
          return;
        }

        if (parsed.intent === "prioritize") {
          const response = await prioritizeTasks(command, commandContext);
          addAssistantMessage({ role: "ai", text: response });
          return;
        }

        if (parsed.intent === "analyze") {
          const response = await analyzeProductivity(command, commandContext);
          addAssistantMessage({ role: "ai", text: response });
          return;
        }

        const { plan, tasks: plannedTasks } = await generateTaskPlan(command, commandContext);
        setGeneratedPlan(plan);
        setPendingTasks(plannedTasks);
        setShowPlanConfirmation(true);
        addAssistantMessage({
          role: "ai",
          text: `Created a ${plan.duration ?? "custom"} roadmap for "${plan.title}". Review it to generate ${plannedTasks.length} tasks.`,
        });
      } catch (error) {
        addAssistantMessage({
          role: "ai",
          text: "Sorry, I encountered an error processing your request. Please try again.",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [addAssistantMessage, commandContext, rescheduleAiTasks],
  );

  const handleQuickAction = useCallback(
    async (action: string) => {
      const prompt = QUICK_ACTION_PROMPTS[action] || "Plan my day";
      await handleAiCommand(prompt);
    },
    [handleAiCommand],
  );

  const handleConfirmPlan = useCallback(() => {
    if (!generatedPlan) return;
    const newTasks = pendingTasks.length > 0 ? pendingTasks : buildTaskDrafts(generatedPlan);
    batchAddTasks(newTasks);
    addAssistantMessage({
      role: "ai",
      text: `Generated ${newTasks.length} tasks for "${generatedPlan.title}". Start with Day 1.`,
    });
    setShowPlanConfirmation(false);
    setGeneratedPlan(null);
    setPendingTasks([]);
  }, [generatedPlan, pendingTasks, batchAddTasks, addAssistantMessage]);

  // ---------- Render ----------
  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Mission Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-5 flex items-center gap-6">
            <div className="relative">
              <ProgressRing
                progress={stats.todayTotal ? (stats.completedToday / stats.todayTotal) * 100 : 0}
                size={80}
              />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {stats.todayTotal ? Math.round((stats.completedToday / stats.todayTotal) * 100) : 0}
                %
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Today's Mission</h2>
              <p className="text-sm text-muted-foreground">
                {stats.completedToday} of {stats.todayTotal} completed
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-400" /> {stats.streak} day streak
                </span>
                <span className="flex items-center gap-1 text-neon-pink">
                  <AlertCircle className="h-3 w-3" /> {stats.overdue} overdue
                </span>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
              This Week
            </h3>
            <WeeklyChart completedByDay={stats.weekly} />
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-neon-purple" />
              <span className="text-sm font-semibold">AI Coach</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCoachLoading ? "Analyzing your current rhythm..." : insight}
            </p>
            <div className="mt-3 flex gap-2 text-[10px]">
              <span className="glass px-2 py-1 rounded-full">
                ⏰ Best time: {coachData?.mostProductiveHour ?? "Morning"}
              </span>
              <span className="glass px-2 py-1 rounded-full">
                ⚡ {coachData?.weakArea ?? "High energy tasks first"}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* AI Command Panel & Quick Actions */}
        <AiCommandPanel onSubmit={handleAiCommand} isLoading={isProcessing} />
        <AiQuickActions onAction={handleQuickAction} isLoading={isProcessing} />

        {/* AI Coach Card (detailed) */}
        <AiCoachCard
          completionRate={stats.completionRate}
          mostProductiveHour={coachData?.mostProductiveHour}
          weakArea={coachData?.weakArea}
          suggestion={coachData?.suggestion}
          tasksCompletedThisWeek={stats.completed}
        />

        {/* Overdue Section */}
        {overdue.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-neon-pink">
              <AlertCircle className="h-4 w-4" />
              Overdue ({overdue.length})
            </div>
            <div className="space-y-2">
              {overdue.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => toggleTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onEdit={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent outline-none text-sm flex-1"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "today", "pending", "done", "high"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize ${filter === f ? "bg-gradient-primary text-white glow-soft" : "glass text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="glass rounded-lg px-3 py-1.5 text-xs outline-none"
          >
            <option value="category">Group: Category</option>
            <option value="dueDate">Group: Due Date</option>
            <option value="priority">Group: Priority</option>
          </select>
          <div className="glass rounded-lg flex p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-white/10" : ""}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`p-1.5 rounded-md ${viewMode === "board" ? "bg-white/10" : ""}`}
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowQuickAdd((prev) => !prev)}
            className="flex items-center gap-1 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-medium text-white glow-soft"
          >
            <Plus className="h-3.5 w-3.5" /> Quick Add
          </button>
        </div>

        {/* Quick Add Form (expandable) */}
        <AnimatePresence>
          {showQuickAdd && (
            <GlassCard className="p-4">
              <QuickAddForm onClose={() => setShowQuickAdd(false)} />
            </GlassCard>
          )}
        </AnimatePresence>

        {/* Task Views */}
        {viewMode === "list" ? (
          <div className="space-y-6">
            {groups.sortedKeys.map((key) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground uppercase">
                  <div className="h-px flex-1 bg-white/10" />
                  {key}
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-2">
                  {groups.groupsMap[key].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      onEdit={() => {}}
                    />
                  ))}
                </div>
              </div>
            ))}
            {rest.length === 0 && overdue.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No missions found. Create your first one!
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {Object.entries(boardCols).map(([col, tasks]) => (
              <div key={col} className="glass rounded-xl p-4 flex-1 min-w-[250px] max-w-[400px]">
                <h3 className="font-semibold text-sm mb-3">
                  {col} ({tasks.length})
                </h3>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      onEdit={() => {}}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plan Confirmation Modal */}
        <PlanConfirmation
          plan={generatedPlan}
          isOpen={showPlanConfirmation}
          isLoading={isProcessing}
          onConfirm={handleConfirmPlan}
          onCancel={() => setShowPlanConfirmation(false)}
        />
      </div>
    </AppShell>
  );
}

function isAiTask(task: Task) {
  return task.tags?.includes("ai-generated");
}
