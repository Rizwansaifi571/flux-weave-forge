import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Priority, type Task } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Search, Trash2, CheckCircle2, Circle, Calendar, Tag, Flame, Clock,
  TrendingUp, Award, Sparkles, FolderKanban, Edit2, X, AlertCircle
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect } from "react";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

// Helper: today's date string
const todayStr = new Date().toISOString().slice(0, 10);

// Priority color & label
const priorityConfig = {
  high: { color: "bg-neon-pink", label: "High", icon: AlertCircle },
  medium: { color: "bg-neon-purple", label: "Medium", icon: Circle },
  low: { color: "bg-neon-blue", label: "Low", icon: Circle },
};

function TasksPage() {
  const { tasks, addTask, toggleTask, deleteTask, updateTask } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "pending" | "done" | "high">("all");
  const [groupBy, setGroupBy] = useState<"category" | "dueDate" | "priority">("category");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(30);

  // ========== Stats & motivation ==========
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completedToday = tasks.filter(t => t.completed && t.dueDate === todayStr).length;
    const tasksToday = tasks.filter(t => t.dueDate === todayStr).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    // Task streak (consecutive days with at least one completion)
    let streak = 0;
    const completionDates = new Set(
      tasks.filter(t => t.completed && t.dueDate).map(t => t.dueDate)
    );
    let current = new Date();
    current.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const dateStr = current.toISOString().slice(0, 10);
      if (completionDates.has(dateStr)) streak++;
      else break;
      current.setDate(current.getDate() - 1);
    }
    return { total, completed, pending, completedToday, tasksToday, completionRate, streak };
  }, [tasks]);

  // ========== Filtered tasks ==========
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      switch (filter) {
        case "today": return task.dueDate === todayStr;
        case "pending": return !task.completed;
        case "done": return task.completed;
        case "high": return task.priority === "high";
        default: return true;
      }
    });
  }, [tasks, searchQuery, filter]);

  // ========== Grouped tasks ==========
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of filteredTasks) {
      let key: string;
      if (groupBy === "category") key = task.category || "Uncategorized";
      else if (groupBy === "dueDate") key = task.dueDate || "No date";
      else key = task.priority;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }
    // Sort groups: for priority, high->medium->low; for dueDate, earliest first; for category, alphabetical
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (groupBy === "priority") {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a as Priority] ?? 3) - (order[b as Priority] ?? 3);
      }
      if (groupBy === "dueDate") {
        if (a === "No date") return 1;
        if (b === "No date") return -1;
        return a.localeCompare(b);
      }
      return a.localeCompare(b);
    });
    return { groups, sortedKeys };
  }, [filteredTasks, groupBy]);

  // Parse tags
  const parsedTags = useMemo(() => tagsInput.split(",").map(t => t.trim()).filter(Boolean), [tagsInput]);

  // Handle add task
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    let validFocus = Math.min(480, Math.max(5, Number(focusMinutes)));
    if (isNaN(validFocus)) validFocus = 30;
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      tags: parsedTags,
      focusMinutes: validFocus,
      category: category.trim() || "General",
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
    });
    // Reset form
    setTitle("");
    setDescription("");
    setCategory("General");
    setTagsInput("");
    setPriority("medium");
    setDueDate("");
    setDueTime("");
    setFocusMinutes(30);
  }, [title, description, priority, parsedTags, focusMinutes, category, dueDate, dueTime, addTask]);

  // Edit task handler
  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
  };
  const saveEdit = (id: string) => {
    if (editTitle.trim()) updateTask(id, { title: editTitle.trim() });
    setEditingTaskId(null);
  };

  // Motivation message
  const motivationMsg = useMemo(() => {
    if (taskStats.completedToday === 0 && taskStats.tasksToday > 0) return "⚡ Start your first task to ignite the streak!";
    if (taskStats.completedToday === taskStats.tasksToday && taskStats.tasksToday > 0) return "🎉 Perfect! All today's tasks done. Amazing discipline!";
    if (taskStats.completionRate === 100 && taskStats.total > 0) return "🏆 You've completed everything! Time to add more goals.";
    if (taskStats.streak >= 7) return `🔥 ${taskStats.streak} day streak! Unstoppable momentum.`;
    if (taskStats.streak >= 3) return `💪 ${taskStats.streak} day streak - keep it going!`;
    return "✨ Every completed task builds your future. Start now.";
  }, [taskStats]);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <PageHeader title="Tasks" subtitle="Manage your missions. Drag energy into action." />

        {/* Stats & Motivation Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Completed Today" value={taskStats.completedToday} suffix={`/${taskStats.tasksToday}`} icon={CheckCircle2} color="text-neon-cyan" />
          <StatCard label="Total Tasks" value={taskStats.total} icon={FolderKanban} color="text-muted-foreground" />
          <StatCard label="Pending" value={taskStats.pending} icon={Clock} color="text-neon-pink" />
          <StatCard label="Completion Rate" value={taskStats.completionRate} suffix="%" icon={TrendingUp} color="text-neon-purple" />
          <StatCard label="Streak" value={taskStats.streak} suffix="days" icon={Flame} color="text-orange-400" />
        </div>

        <GlassCard className="mb-4 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-neon-purple" />
            <span className="text-muted-foreground">✨ Motivation:</span>
            <span className="font-medium">{motivationMsg}</span>
          </div>
          {/* Daily progress bar */}
          {taskStats.tasksToday > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Today's progress</span>
                <span>{taskStats.completedToday}/{taskStats.tasksToday}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: `${(taskStats.completedToday / taskStats.tasksToday) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </GlassCard>

        {/* Add Task Form (improved layout) */}
        <GlassCard className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary glow-soft">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a new mission..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                required
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="glass rounded-lg px-3 py-1.5 text-xs outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button type="submit" className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-medium text-white glow-soft hover:opacity-90 transition">
                Add
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="glass rounded-lg px-3 py-2 text-xs outline-none" />
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g., Work, Fitness)" className="glass rounded-lg px-3 py-2 text-xs outline-none" />
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags (comma separated)" className="glass rounded-lg px-3 py-2 text-xs outline-none" />
              <div className="flex gap-2">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="glass rounded-lg px-3 py-2 text-xs outline-none w-1/2" />
                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="glass rounded-lg px-3 py-2 text-xs outline-none w-1/2" />
              </div>
            </div>
            <div className="flex justify-end">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Focus minutes:
                <input type="number" step={5} min={5} max={480} value={focusMinutes} onChange={(e) => setFocusMinutes(Number(e.target.value))} className="glass w-20 rounded-lg px-2 py-1 text-xs outline-none" />
              </label>
            </div>
          </form>
        </GlassCard>

        {/* Search & Filters + Group by */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 flex-1 min-w-[180px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks..." className="bg-transparent outline-none text-sm flex-1" />
          </div>
          <div className="flex gap-1.5">
            {(["all", "today", "pending", "done", "high"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition ${filter === f ? "bg-gradient-primary text-white glow-soft" : "glass text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="glass rounded-lg px-3 py-1.5 text-xs outline-none">
            <option value="category">Group by Category</option>
            <option value="dueDate">Group by Due Date</option>
            <option value="priority">Group by Priority</option>
          </select>
        </div>

        {/* Task List with Grouping */}
        <div className="space-y-4">
          {groupedTasks.sortedKeys.map((groupKey) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="h-px flex-1 bg-white/10" />
                <span>{groupKey}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <AnimatePresence mode="popLayout">
                {groupedTasks.groups[groupKey].map((task) => (
                  <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} whileHover={{ scale: 1.005 }} className="glass rounded-xl p-4 flex items-center gap-4 group">
                    <button onClick={() => toggleTask(task.id)} className="shrink-0">
                      {task.completed ? <CheckCircle2 className="h-5 w-5 text-neon-cyan" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-neon-purple transition" />}
                    </button>
                    <div className={`h-8 w-1 rounded-full ${priorityConfig[task.priority].color}`} />
                    <div className="flex-1 min-w-0">
                      {editingTaskId === task.id ? (
                        <div className="flex gap-2 items-center">
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="glass rounded px-2 py-1 text-sm outline-none flex-1" autoFocus />
                          <button onClick={() => saveEdit(task.id)} className="text-neon-cyan"><CheckCircle2 className="h-4 w-4" /></button>
                          <button onClick={() => setEditingTaskId(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <>
                          <div className={`font-medium text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </div>
                          {task.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</div>}
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {task.category && <span className="text-[10px] glass px-1.5 py-0.5 rounded-full flex items-center gap-1"><Tag className="h-2 w-2" />{task.category}</span>}
                            {task.tags?.map(t => <span key={t} className="text-[10px] glass px-1.5 py-0.5 rounded-full">#{t}</span>)}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                      {task.dueDate && <span className={`flex items-center gap-1 ${task.dueDate < todayStr && !task.completed ? "text-neon-pink" : ""}`}><Calendar className="h-3 w-3" />{task.dueDate}</span>}
                      {task.dueTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.dueTime}</span>}
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{task.focusMinutes}m</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(task)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-neon-cyan" aria-label="Edit task"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-neon-pink" aria-label="Delete task"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
          {filteredTasks.length === 0 && <div className="text-center text-sm text-muted-foreground py-16">No tasks match. Time to create one.</div>}
        </div>
      </div>
    </AppShell>
  );
}

// Simple StatCard component
function StatCard({ label, value, suffix = "", icon: Icon, color }: { label: string; value: number; suffix?: string; icon: any; color: string }) {
  return (
    <GlassCard className="p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <div className="text-xl font-bold">
        {value}{suffix && <span className="text-xs ml-0.5">{suffix}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </GlassCard>
  );
}