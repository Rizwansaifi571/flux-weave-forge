import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Priority } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Trash2, CheckCircle2, Circle, Calendar, Tag, Flame } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const { tasks, addTask, toggleTask, deleteTask } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "pending" | "done" | "high">("all");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "today") return t.dueDate === today;
    if (filter === "pending") return !t.completed;
    if (filter === "done") return t.completed;
    if (filter === "high") return t.priority === "high";
    return true;
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title, priority, tags: [], focusMinutes: 30, category: "General", dueDate: today });
    setTitle("");
  };

  const priColor = (p: Priority) => p === "high" ? "bg-neon-pink" : p === "medium" ? "bg-neon-purple" : "bg-neon-blue";

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader title="Tasks" subtitle="Manage your missions. Drag energy into action." />

        <GlassCard className="mb-6">
          <form onSubmit={submit} className="flex gap-2 items-center">
            <div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary glow-soft">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a new mission..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="glass rounded-lg px-3 py-1.5 text-xs outline-none">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-medium text-white glow-soft hover:opacity-90 transition">
              Add
            </button>
          </form>
        </GlassCard>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="bg-transparent outline-none text-sm flex-1" />
          </div>
          {(["all", "today", "pending", "done", "high"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition ${filter === f ? "bg-gradient-primary text-white glow-soft" : "glass text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ scale: 1.005 }}
                className="glass rounded-xl p-4 flex items-center gap-4 group"
              >
                <button onClick={() => toggleTask(t.id)} className="shrink-0">
                  {t.completed ? <CheckCircle2 className="h-5 w-5 text-neon-cyan" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-neon-purple transition" />}
                </button>
                <div className={`h-8 w-1 rounded-full ${priColor(t.priority)}`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</div>}
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  {t.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.dueDate}</span>}
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{t.focusMinutes}m</span>
                  <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{t.category}</span>
                </div>
                <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-neon-pink">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">No tasks match. Time to create one.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}