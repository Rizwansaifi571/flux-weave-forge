import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Priority } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Trash2, CheckCircle2, Circle, Calendar, Tag, Flame, Clock } from "lucide-react";
import { useMemo, useState, useCallback } from "react";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const { tasks, addTask, toggleTask, deleteTask } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "pending" | "done" | "high">("all");
  
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(30);

  // Today's date for filtering
  const today = new Date().toISOString().slice(0, 10);

  // Memoized filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Status filters
      switch (filter) {
        case "today":
          return task.dueDate === today;
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
  }, [tasks, searchQuery, filter, today]);

  // Parse tags from comma-separated string
  const parsedTags = useMemo(() => {
    return tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [tagsInput]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;

      // Validate and clamp focus minutes
      let validFocusMinutes = Math.min(480, Math.max(5, Number(focusMinutes)));
      if (isNaN(validFocusMinutes)) validFocusMinutes = 30;

      addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        tags: parsedTags,
        focusMinutes: validFocusMinutes,
        category: category.trim() || "General",
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
      });

      // Reset form fields (optional but improves UX)
      setTitle("");
      setDescription("");
      setCategory("General");
      setTagsInput("");
      setPriority("medium");
      setDueDate("");
      setDueTime("");
      setFocusMinutes(30);
    },
    [title, description, priority, parsedTags, focusMinutes, category, dueDate, dueTime, addTask]
  );

  // Priority color mapping
  const priorityColor = (p: Priority) => {
    switch (p) {
      case "high": return "bg-neon-pink";
      case "medium": return "bg-neon-purple";
      default: return "bg-neon-blue";
    }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader title="Tasks" subtitle="Manage your missions. Drag energy into action." />

        {/* Add Task Form */}
        <GlassCard className="mb-6">
          <form onSubmit={handleSubmit} className="grid gap-3">
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
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-medium text-white glow-soft hover:opacity-90 transition"
              >
                Add
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-3">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
              />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category (e.g. DSA, College, Fitness)"
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_140px] gap-3">
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma separated)"
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
                aria-label="Due date"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
                aria-label="Due time"
              />
              <input
                type="number"
                step={5}
                min={5}
                max={480}
                value={focusMinutes}
                onChange={(e) => setFocusMinutes(Number(e.target.value))}
                className="glass rounded-lg px-3 py-2 text-xs outline-none"
                aria-label="Focus minutes (5-480)"
              />
            </div>
          </form>
        </GlassCard>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent outline-none text-sm flex-1"
            />
          </div>
          {(["all", "today", "pending", "done", "high"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition ${
                filter === f
                  ? "bg-gradient-primary text-white glow-soft"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ scale: 1.005 }}
                className="glass rounded-xl p-4 flex items-center gap-4 group"
              >
                <button onClick={() => toggleTask(task.id)} className="shrink-0">
                  {task.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-neon-cyan" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-neon-purple transition" />
                  )}
                </button>
                <div className={`h-8 w-1 rounded-full ${priorityColor(task.priority)}`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</div>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {task.dueDate}
                    </span>
                  )}
                  {task.dueTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.dueTime}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {task.focusMinutes}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {task.category}
                  </span>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-neon-pink"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredTasks.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">
              No tasks match. Time to create one.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}