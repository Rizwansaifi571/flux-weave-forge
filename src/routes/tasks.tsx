import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AiCommandPanel } from "@/components/AiCommandPanel";
import { AiQuickActions } from "@/components/AiQuickActions";
import { AiCoachCard } from "@/components/AiCoachCard";
import { PlanConfirmation, type GeneratedPlan } from "@/components/PlanConfirmation";
import { askAssistant } from "@/lib/api/assistant.functions";
import { applyAiActions } from "@/lib/ai/task-actions";
import type { AiContext } from "@/lib/ai/ai-types";
import { useStore, type Priority, type Task } from "@/lib/store";
import { parseCommand, QUICK_ACTION_PROMPTS } from "@/lib/ai-utils";
import { generateCoachInsight } from "@/lib/ai/task-coach";
import { generateTaskPlan, buildTaskDrafts } from "@/lib/ai/task-planner";
import { planDay } from "@/lib/ai/task-scheduler";
import { prioritizeTasks } from "@/lib/ai/task-prioritizer";
import { analyzeProductivity } from "@/lib/ai/task-analyzer";
import { addLocalDays, formatLocalDate, startOfLocalDay } from "@/lib/date";
import { buildLocalRoadmapFallback } from "@/lib/ai/task-command-local";
import { extractRoadmapSource } from "@/lib/api/roadmap-source.functions";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Search, Trash2, CheckCircle2, Circle, Calendar, Flame, Clock, Sparkles,
  AlertCircle, List, Columns, Zap, PencilLine, RefreshCw,
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const todayStr = formatLocalDate();
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

type TaskFormState = {
  title: string; description: string; priority: Priority;
  dueDate: string; dueTime: string; focusMinutes: number;
  category: string; tagsInput: string; completed: boolean;
};

function toTimeMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
function minutesToClock(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function formatTimeInput(value?: string) { return value?.slice(0,5) ?? ""; }
function parseTagsInput(input: string) { return input.split(",").map(t=>t.trim()).filter(Boolean); }
function buildTaskForm(task?: Task | null): TaskFormState {
  return {
    title: task?.title ?? "", description: task?.description ?? "", priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ?? "", dueTime: formatTimeInput(task?.dueTime), focusMinutes: task?.focusMinutes ?? 30,
    category: task?.category ?? "General", tagsInput: task?.tags?.join(", ") ?? "", completed: task?.completed ?? false,
  };
}
function isTaskOverdue(task: Task, now = new Date()) {
  if (task.completed || !task.dueDate) return false;
  const dueDate = new Date(`${task.dueDate}T00:00:00`);
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  if (dueDate < todayStart) return true;
  if (dueDate > todayStart) return false;
  const dueMinutes = toTimeMinutes(task.dueTime);
  return dueMinutes != null && (now.getHours()*60 + now.getMinutes()) > dueMinutes;
}
function formatDueLabel(task: Task) {
  if (!task.dueDate) return "No due date";
  return task.dueTime ? `${task.dueDate} at ${task.dueTime}` : task.dueDate;
}
function formatDueStatus(task: Task, now = new Date()) {
  if (task.completed) return "Completed";
  if (isTaskOverdue(task, now)) return "Overdue";
  return task.dueDate ? "On track" : "Flexible";
}
function calculateCompletionStreak(tasks: Task[]) {
  const completedDates = new Set(tasks.filter(t=>t.completedAt).map(t=>formatLocalDate(new Date(t.completedAt as string))));
  const cursor = startOfLocalDay();
  let streak = 0;
  while (completedDates.has(formatLocalDate(cursor))) { streak++; cursor.setDate(cursor.getDate()-1); }
  return streak;
}

// ---------- Helper Components (unchanged from your version) ----------
function ProgressRing({ progress, size=80, strokeWidth=6 }) {
  const radius = (size-strokeWidth)/2;
  const circumference = 2*Math.PI*radius;
  const offset = circumference - (progress/100)*circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
      <motion.circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="url(#gradient)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} initial={{strokeDashoffset:circumference}} animate={{strokeDashoffset:offset}} />
      <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient></defs>
    </svg>
  );
}
function WeeklyChart({ completedByDay }) {
  const max = Math.max(...completedByDay,1);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return <div className="flex items-end gap-1 h-16">{completedByDay.map((val,i)=>(
    <div key={i} className="flex-1 flex flex-col items-center">
      <motion.div className="w-full rounded-t bg-gradient-to-t from-neon-purple to-neon-cyan" initial={{height:0}} animate={{height:`${(val/max)*100}%`}} style={{minHeight:val>0?"4px":"0"}} />
      <span className="text-[9px] mt-1 text-muted-foreground">{days[i]}</span>
    </div>
  ))}</div>;
}
function QuickAddForm({ onClose }) {
  const { addTask } = useStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [energy, setEnergy] = useState<EnergyLevel>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(30);
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    if(!title.trim()) return;
    addTask({ title: title.trim(), priority, energy, focusMinutes: Math.min(480,Math.max(5,focusMinutes||30)), category: category.trim()||"General", tags: parseTagsInput(tagsInput), dueDate: dueDate||undefined, dueTime: dueTime||undefined });
    setTitle(""); setPriority("medium"); setEnergy("medium"); setDueDate(""); setDueTime(""); setFocusMinutes(30); onClose();
  };
  return (
    <motion.form initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} onSubmit={handleSubmit} className="space-y-3 overflow-hidden">
      <div className="flex gap-2 items-center"><div className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary glow-soft"><Plus className="h-4 w-4 text-white"/></div><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="What's your mission?" className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground font-medium" autoFocus /><button type="submit" className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-medium text-white glow-soft hover:opacity-90 transition">Add</button></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <select value={priority} onChange={e=>setPriority(e.target.value as Priority)} className="glass rounded-lg px-2 py-1.5 text-xs outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <select value={energy} onChange={e=>setEnergy(e.target.value as EnergyLevel)} className="glass rounded-lg px-2 py-1.5 text-xs outline-none"><option value="low">Low Energy</option><option value="medium">Medium Energy</option><option value="high">High Energy</option></select>
        <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="glass rounded-lg px-2 py-1.5 text-xs outline-none" />
        <input type="time" value={dueTime} onChange={e=>setDueTime(e.target.value)} className="glass rounded-lg px-2 py-1.5 text-xs outline-none" />
        <input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Category" className="glass rounded-lg px-2 py-1.5 text-xs outline-none" />
        <input value={tagsInput} onChange={e=>setTagsInput(e.target.value)} placeholder="Tags (csv)" className="glass rounded-lg px-2 py-1.5 text-xs outline-none" />
        <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground"/><input type="number" min={5} max={480} value={focusMinutes} onChange={e=>setFocusMinutes(Number(e.target.value))} className="glass w-16 rounded-lg px-2 py-1.5 text-xs outline-none"/><span className="text-[10px] text-muted-foreground">min</span></div>
      </div>
    </motion.form>
  );
}
function TaskCard({ task, onToggle, onDelete, onEdit, compact=false }) {
  return (
    <motion.div layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}} whileHover={{scale:1.01}} className={`group glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition ${task.completed?"opacity-70":""}`} onClick={(e)=>{if((e.target as HTMLElement).closest("button, input")) return; onEdit();}}>
      <button onClick={onToggle} className="shrink-0">{task.completed?<CheckCircle2 className="h-5 w-5 text-neon-cyan"/>:<Circle className="h-5 w-5 text-muted-foreground hover:text-neon-purple transition"/>}</button>
      <div className={`h-8 w-1 rounded-full ${priorityConfig[task.priority].color}`} />
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-sm ${task.completed?"line-through text-muted-foreground":""}`}>{task.title}</div>
        {!compact && <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3"/>{formatDueStatus(task)}</span>
          {task.energy && <span className="flex items-center gap-1"><Zap className="h-3 w-3"/>{task.energy}</span>}
          {task.dueDate && <span className={`flex items-center gap-1 ${isTaskOverdue(task)?"text-neon-pink":""}`}><Calendar className="h-3 w-3"/>{formatDueLabel(task)}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{task.focusMinutes}m</span>
          {task.description && <span className="glass px-1.5 py-0.5 rounded-full text-[10px] max-w-[220px] truncate">{task.description}</span>}
          {task.tags?.slice(0,2).map(t=><span key={t} className="glass px-1.5 py-0.5 rounded-full text-[10px]">#{t}</span>)}
        </div>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-neon-cyan"><PencilLine className="h-3.5 w-3.5"/></button>
        <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-neon-pink"><Trash2 className="h-3.5 w-3.5"/></button>
      </div>
    </motion.div>
  );
}
function TaskEditorDialog({ task, open, onOpenChange, onSave, onDelete }) {
  const [form, setForm] = useState<TaskFormState>(()=>buildTaskForm(task));
  useEffect(()=>{setForm(buildTaskForm(task));},[task]);
  if(!task) return null;
  const updateField = (key,value)=>setForm(prev=>({...prev,[key]:value}));
  const handleSave = () => {
    onSave({ title: form.title.trim(), description: form.description.trim()||undefined, priority: form.priority, dueDate: form.dueDate||undefined, dueTime: form.dueTime||undefined, focusMinutes: Math.min(480,Math.max(5,Number(form.focusMinutes)||30)), category: form.category.trim()||"General", tags: parseTagsInput(form.tagsInput), completed: form.completed });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><PencilLine className="h-4 w-4 text-neon-cyan"/>Edit Task</DialogTitle><DialogDescription>Refine any detail manually.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]"><div className="space-y-2"><label className="text-xs text-muted-foreground">Title</label><input value={form.title} onChange={e=>updateField("title",e.target.value)} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div><div className="space-y-2"><label className="text-xs text-muted-foreground">Category</label><input value={form.category} onChange={e=>updateField("category",e.target.value)} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div></div>
          <div className="space-y-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={form.description} onChange={e=>updateField("description",e.target.value)} className="glass w-full min-h-[96px] rounded-xl px-3 py-2 text-sm outline-none resize-none"/></div>
          <div className="grid gap-3 md:grid-cols-4"><div className="space-y-2"><label className="text-xs text-muted-foreground">Priority</label><select value={form.priority} onChange={e=>updateField("priority",e.target.value as Priority)} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div className="space-y-2"><label className="text-xs text-muted-foreground">Due date</label><input type="date" value={form.dueDate} onChange={e=>updateField("dueDate",e.target.value)} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div><div className="space-y-2"><label className="text-xs text-muted-foreground">Due time</label><input type="time" value={form.dueTime} onChange={e=>updateField("dueTime",e.target.value)} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div><div className="space-y-2"><label className="text-xs text-muted-foreground">Focus mins</label><input type="number" min={5} max={480} value={form.focusMinutes} onChange={e=>updateField("focusMinutes",Number(e.target.value))} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div></div>
          <div className="space-y-2"><label className="text-xs text-muted-foreground">Tags</label><input value={form.tagsInput} onChange={e=>updateField("tagsInput",e.target.value)} placeholder="study, course, urgent" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"/></div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><div><p className="text-sm font-medium">Completion state</p><p className="text-xs text-muted-foreground">{form.completed?"This task is marked as complete.":"This task is still active."}</p></div><button type="button" onClick={()=>updateField("completed",!form.completed)} className={`rounded-xl px-3 py-2 text-xs font-medium transition ${form.completed?"bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20":"bg-white/10 text-white border border-white/10"}`}>{form.completed?"Mark active":"Mark complete"}</button></div>
          <div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={onDelete} className="rounded-xl border border-neon-pink/30 bg-neon-pink/10 px-4 py-2 text-sm font-medium text-neon-pink">Delete task</button><div className="flex-1"/><button type="button" onClick={()=>onOpenChange(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium">Cancel</button><button type="button" onClick={handleSave} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-medium text-white glow-soft">Save changes</button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Page ----------
function TasksPage() {
  const {
    tasks, habits, goals, lifeContext, focusSessions, playlistImports, assistantMessages,
    addTask, batchAddTasks, addGoal, toggleTask, deleteTask, updateTask, addAssistantMessage, userName,
  } = useStore();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<TaskInput[]>([]);
  const [coachData, setCoachData] = useState<{mostProductiveHour:string; weakArea:string; suggestion:string} | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const coachSignatureRef = useRef<string | null>(null);

  // ---------- Stats ----------
  const stats = useMemo(()=>{
    const total = tasks.length;
    const completed = tasks.filter(t=>t.completed).length;
    const pending = total-completed;
    const todayTasks = tasks.filter(t=>t.dueDate===todayStr);
    const completedToday = todayTasks.filter(t=>t.completed).length;
    const overdue = tasks.filter(t=>isTaskOverdue(t)).length;
    const completionRate = total?Math.round((completed/total)*100):0;
    const streak = calculateCompletionStreak(tasks);
    const weekly = new Array(7).fill(0);
    for(let i=0;i<7;i++){ const ds = addLocalDays(todayStr,-(6-i)); weekly[i]=tasks.filter(t=>t.completed && t.dueDate===ds).length; }
    return { total, completed, pending, completedToday, todayTotal: todayTasks.length, overdue, completionRate, streak, weekly };
  },[tasks]);

  const editingTask = useMemo(()=>tasks.find(t=>t.id===editingTaskId)??null,[editingTaskId,tasks]);
  const focusToday = useMemo(()=>focusSessions.find(s=>s.date===todayStr)?.minutes??0,[focusSessions]);

  // ---------- Reschedule overdue tasks (smart) ----------
  const rescheduleOverdueTasks = useCallback(()=>{
    const overdueTasks = tasks.filter(t=>isTaskOverdue(t)).sort((a,b)=>(a.dueDate??"").localeCompare(b.dueDate??"") || a.createdAt.localeCompare(b.createdAt));
    if(overdueTasks.length===0) return 0;
    const preferredStart = toTimeMinutes(lifeContext.preferredStudyHours.start)??540;
    const preferredEnd = toTimeMinutes(lifeContext.preferredStudyHours.end);
    const daySpan = preferredEnd!=null ? (preferredEnd>preferredStart ? preferredEnd-preferredStart : 24*60 - preferredStart + preferredEnd) : 0;
    const dayCapacity = daySpan>0 ? Math.max(90,daySpan) : 180;
    let updated=0, cursorDate = new Date(`${todayStr}T00:00:00`), usedToday=0;
    overdueTasks.forEach(task=>{
      const effort = Math.max(15,Math.min(240,task.focusMinutes||30));
      if(usedToday>0 && usedToday+effort>dayCapacity){ cursorDate = new Date(cursorDate.getTime()+DAY_MS); usedToday=0; }
      const dueDate = formatLocalDate(cursorDate);
      const dueTime = minutesToClock(preferredStart + usedToday);
      updateTask(task.id,{ dueDate, dueTime });
      usedToday+=effort;
      updated++;
    });
    return updated;
  },[lifeContext.preferredStudyHours, tasks, updateTask]);

  // ---------- Define contexts (must be before handlers that use them) ----------
  const coachContext = useMemo<AiContext>(()=>({
    userName, today:todayStr,
    tasks: tasks.map(t=>({ id:t.id, title:t.title, description:t.description, dueDate:t.dueDate, dueTime:t.dueTime, priority:t.priority, category:t.category, focusMinutes:t.focusMinutes, tags:t.tags, completed:t.completed })),
    habits: habits.map(h=>({ id:h.id, name:h.name, emoji:h.emoji, doneToday:Boolean(h.history[todayStr]) })),
    focusToday, streakCount:stats.streak,
    goals: goals.map(g=>({ id:g.id, title:g.title, progress:g.progress, deadline:g.deadline, category:g.category, status:g.status })),
    lifeContext: {
      collegeTimetable: lifeContext.collegeTimetable.map(e=>({ day:e.day, start:e.start, end:e.end, label:e.label })),
      exams: lifeContext.exams.map(e=>({ title:e.title, date:e.date, course:e.course })),
      internships: lifeContext.internships.map(i=>({ company:i.company, role:i.role, startDate:i.startDate, endDate:i.endDate, status:i.status })),
      sleepSchedule: lifeContext.sleepSchedule, preferredStudyHours: lifeContext.preferredStudyHours, placementGoals: lifeContext.placementGoals,
    },
    recentMessages: [], playlistImports: playlistImports.map(p=>({ id:p.id, title:p.title, items:p.items }))
  }),[focusToday,goals,habits,lifeContext,playlistImports,stats.streak,tasks,userName]);

  const taskCommandContext = useMemo<AiContext>(()=>({
    userName, today:todayStr,
    tasks: tasks.map(t=>({ id:t.id, title:t.title, description:t.description, dueDate:t.dueDate, dueTime:t.dueTime, priority:t.priority, category:t.category, focusMinutes:t.focusMinutes, tags:t.tags, completed:t.completed })),
    habits: habits.map(h=>({ id:h.id, name:h.name, emoji:h.emoji, doneToday:Boolean(h.history[todayStr]) })),
    focusToday, streakCount:stats.streak,
    goals: goals.map(g=>({ id:g.id, title:g.title, progress:g.progress, deadline:g.deadline, category:g.category, status:g.status })),
    lifeContext: {
      collegeTimetable: lifeContext.collegeTimetable.map(e=>({ day:e.day, start:e.start, end:e.end, label:e.label })),
      exams: lifeContext.exams.map(e=>({ title:e.title, date:e.date, course:e.course })),
      internships: lifeContext.internships.map(i=>({ company:i.company, role:i.role, startDate:i.startDate, endDate:i.endDate, status:i.status })),
      sleepSchedule: lifeContext.sleepSchedule, preferredStudyHours: lifeContext.preferredStudyHours, placementGoals: lifeContext.placementGoals,
    },
    recentMessages: assistantMessages.slice(-12).map(m=>({ role:m.role, text:m.text })),
    playlistImports: playlistImports.map(p=>({ id:p.id, title:p.title, items:p.items }))
  }),[assistantMessages,focusToday,goals,habits,lifeContext,playlistImports,stats.streak,tasks,userName]);

  // ---------- YouTube playlist handler ----------
  const handleYouTubePlaylistCommand = useCallback(async (command: string) => {
    const urlMatch = command.match(/(https?:\/\/[^\s]+)/i);
    if (!urlMatch) return null;
    const url = urlMatch[0];
    const daysMatch = command.match(/(\d+)\s*days?\b/i);
    const targetDays = daysMatch ? parseInt(daysMatch[1]) : 30;
    const source = await extractRoadmapSource({ data: { input: url } }).catch(err => {
      console.error("Playlist fetch failed:", err);
      return null;
    });
    if (!source || source.items.length === 0) return null;
    const items = [];
    const totalVideos = source.items.length;
    const videosPerDay = Math.ceil(totalVideos / targetDays);
    for (let day = 0; day < targetDays; day++) {
      const startIdx = day * videosPerDay;
      const endIdx = Math.min(startIdx + videosPerDay, totalVideos);
      const dayVideos = source.items.slice(startIdx, endIdx);
      if (dayVideos.length === 0) break;
      items.push({
        phase: `Day ${day+1}`,
        description: `${dayVideos.length} video${dayVideos.length>1?'s':''} · ${dayVideos[0].title}${dayVideos.length>1?` +${dayVideos.length-1} more`:''}`,
        taskCount: dayVideos.length,
        taskTitles: dayVideos.map(v=>v.title),
        taskDurationsMinutes: dayVideos.map(v=>v.durationMinutes??45),
      });
    }
    const plan: GeneratedPlan = {
      title: source.title || "YouTube Playlist Roadmap",
      description: `${totalVideos} videos scheduled over ${targetDays} days.`,
      duration: `${targetDays} days`,
      estimatedCommitment: `${Math.round((source.items.reduce((sum,v)=>sum+(v.durationMinutes??45),0)/targetDays))} min/day`,
      items, totalTasks: totalVideos,
    };
    const tasksDrafts = buildTaskDrafts(plan, { startDate: todayStr, timeWindow: lifeContext.preferredStudyHours });
    return { plan, tasks: tasksDrafts };
  }, [lifeContext.preferredStudyHours]);

  // ---------- AI handlers ----------
  const handleAiCommand = useCallback(async (command: string) => {
    setIsProcessing(true);
    addAssistantMessage({ role: "user", text: command });
    try {
      // 1. YouTube playlist command
      const playlistPlan = await handleYouTubePlaylistCommand(command);
      if (playlistPlan) {
        setGeneratedPlan(playlistPlan.plan);
        setPendingTasks(playlistPlan.tasks);
        setShowPlanConfirmation(true);
        addAssistantMessage({ role: "ai", text: `Prepared a ${playlistPlan.plan.duration} plan from the playlist "${playlistPlan.plan.title}". Review to add ${playlistPlan.tasks.length} tasks.` });
        return;
      }

      const parsed = parseCommand(command);
      if (parsed.intent === "reschedule") {
        const updated = rescheduleOverdueTasks();
        addAssistantMessage({ role: "ai", text: updated ? `Rebalanced ${updated} overdue tasks.` : "No overdue tasks found." });
        return;
      }
      if (parsed.intent === "plan_day") {
        const response = await planDay(command, taskCommandContext);
        addAssistantMessage({ role: "ai", text: response });
        return;
      }
      if (parsed.intent === "plan_week") {
        const response = await askAssistant({ data: { message: "Create a concise, actionable weekly plan from my current tasks, overdue work, goals, and study window.", context: taskCommandContext } });
        addAssistantMessage({ role: "ai", text: response.response });
        return;
      }
      if (parsed.intent === "prioritize") {
        const response = await prioritizeTasks(command, taskCommandContext);
        addAssistantMessage({ role: "ai", text: response });
        return;
      }
      if (parsed.intent === "analyze") {
        const response = await analyzeProductivity(command, taskCommandContext);
        addAssistantMessage({ role: "ai", text: response });
        return;
      }

      if (/\b(edit|update|change|delete|remove|rename|complete|finish)\b/i.test(command) && !/\b(create|make|build|plan)\b/i.test(command)) {
        addAssistantMessage({ role: "ai", text: "Pick a task card to edit, or tell me the exact task title and change." });
        return;
      }

      const looksLikeTaskCrud = /\b(add|create|make|build|edit|update|change|delete|remove|rename|complete|finish|schedule|postpone|move)\b/i.test(command) || /\b(task|tasks|todo|to-do|schedule)\b/i.test(command);
      if (looksLikeTaskCrud) {
        try {
          const response = await askAssistant({ data: { message: command, context: taskCommandContext } });
          if (response.actions?.length) {
            const applied = applyAiActions(response.actions, { addTask, batchAddTasks, updateTask, deleteTask, addGoal });
            addAssistantMessage({ role: "ai", text: `Applied ${applied} task change${applied===1?'':'s'}. ${response.response}`.trim() });
          } else {
            addAssistantMessage({ role: "ai", text: response.response });
          }
        } catch {
          const fallback = buildLocalRoadmapFallback(command, taskCommandContext);
          setGeneratedPlan(fallback.plan);
          setPendingTasks(fallback.tasks);
          setShowPlanConfirmation(true);
          addAssistantMessage({ role: "ai", text: `Local roadmap prepared: "${fallback.plan.title}".` });
        }
        return;
      }

      try {
        const { plan, tasks: plannedTasks } = await generateTaskPlan(command, taskCommandContext);
        setGeneratedPlan(plan);
        setPendingTasks(plannedTasks);
        setShowPlanConfirmation(true);
        addAssistantMessage({ role: "ai", text: `Created a ${plan.duration??"custom"} roadmap for "${plan.title}".` });
      } catch {
        const fallback = buildLocalRoadmapFallback(command, taskCommandContext);
        setGeneratedPlan(fallback.plan);
        setPendingTasks(fallback.tasks);
        setShowPlanConfirmation(true);
        addAssistantMessage({ role: "ai", text: `Local roadmap prepared: "${fallback.plan.title}".` });
      }
    } catch (error) {
      addAssistantMessage({ role: "ai", text: "Sorry, I encountered an error. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  }, [addAssistantMessage, addGoal, addTask, batchAddTasks, deleteTask, handleYouTubePlaylistCommand, rescheduleOverdueTasks, taskCommandContext, updateTask]);

  const handleQuickAction = useCallback(async (action: string) => {
    await handleAiCommand(QUICK_ACTION_PROMPTS[action] || "Plan my day");
  }, [handleAiCommand]);

  const handleConfirmPlan = useCallback(() => {
    if(!generatedPlan) return;
    const newTasks = pendingTasks.length>0 ? pendingTasks : buildTaskDrafts(generatedPlan, { startDate: todayStr, timeWindow: lifeContext.preferredStudyHours });
    batchAddTasks(newTasks);
    addAssistantMessage({ role: "ai", text: `Generated ${newTasks.length} tasks for "${generatedPlan.title}".` });
    setShowPlanConfirmation(false);
    setGeneratedPlan(null);
    setPendingTasks([]);
  }, [addAssistantMessage, batchAddTasks, generatedPlan, lifeContext.preferredStudyHours, pendingTasks]);

  // ---------- Coach effect ----------
  useEffect(() => {
    let cancelled = false;
    const signature = JSON.stringify({
      completed: stats.completed, overdue: stats.overdue, completionRate: stats.completionRate,
      streak: stats.streak, focusToday, pending: stats.pending,
      topTasks: tasks.slice(0,5).map(t=>({ title:t.title, priority:t.priority, dueDate:t.dueDate, completed:t.completed })),
    });
    if(coachSignatureRef.current === signature) return ()=>{cancelled=true;};
    coachSignatureRef.current = signature;
    setIsCoachLoading(true);
    void (async() => {
      try {
        const insightData = await generateCoachInsight(coachContext);
        if(!cancelled) setCoachData({ mostProductiveHour: insightData.mostProductiveHour, weakArea: insightData.weakArea, suggestion: insightData.suggestion });
      } catch {
        if(!cancelled) setCoachData({ mostProductiveHour:"Morning", weakArea:"Task follow-through", suggestion:"Pick one high-priority task and protect a 45-minute focus block for it today." });
      } finally { if(!cancelled) setIsCoachLoading(false); }
    })();
    return ()=>{cancelled=true;};
  }, [coachContext, focusToday, stats.completed, stats.completionRate, stats.overdue, stats.pending, stats.streak, tasks]);

  const insight = useMemo(()=>{
    if(coachData?.suggestion) return coachData.suggestion;
    if(stats.overdue>3) return "You have multiple overdue tasks. Focus on the oldest first to regain momentum.";
    if(stats.completionRate>=80) return "You're crushing it! Keep the momentum by tackling high-energy tasks in the morning.";
    if(stats.streak>=5) return `${stats.streak}-day streak! Consistency is your superpower.`;
    return "Start with a quick win to build momentum.";
  },[coachData,stats]);

  // ---------- Filtering / grouping ----------
  const filteredTasks = useMemo(()=>tasks.filter(task=>{
    if(searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && !task.tags?.some(t=>t.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    switch(filter){
      case "today": return task.dueDate===todayStr;
      case "pending": return !task.completed;
      case "done": return task.completed;
      case "high": return task.priority==="high";
      default: return true;
    }
  }),[tasks,searchQuery,filter]);
  const { overdue, rest } = useMemo(()=>{
    const overdueTasks = filteredTasks.filter(t=>isTaskOverdue(t));
    const restTasks = filteredTasks.filter(t=>!overdueTasks.includes(t));
    return { overdue: overdueTasks, rest: restTasks };
  },[filteredTasks]);
  const groups = useMemo(()=>{
    const groupsMap: Record<string, Task[]> = {};
    rest.forEach(task=>{
      let key: string;
      switch(groupBy){
        case "dueDate": key = task.dueDate || "No date"; break;
        case "priority": key = task.priority; break;
        default: key = task.category || "Uncategorized";
      }
      if(!groupsMap[key]) groupsMap[key]=[];
      groupsMap[key].push(task);
    });
    const sortedKeys = Object.keys(groupsMap).sort((a,b)=>{
      if(groupBy==="priority"){ const order:{[k:string]:number}={ high:0, medium:1, low:2 }; return (order[a]??3)-(order[b]??3); }
      if(groupBy==="dueDate"){ if(a==="No date") return 1; if(b==="No date") return -1; return a.localeCompare(b); }
      return a.localeCompare(b);
    });
    return { groupsMap, sortedKeys };
  },[rest,groupBy]);
  const boardCols = useMemo(()=>{
    const cols: Record<string, Task[]> = {};
    rest.forEach(task=>{
      let key: string;
      switch(groupBy){
        case "dueDate": key = task.dueDate || "No date"; break;
        case "priority": key = task.priority; break;
        default: key = task.category || "Uncategorized";
      }
      if(!cols[key]) cols[key]=[];
      cols[key].push(task);
    });
    return cols;
  },[groupBy,rest]);

  // ---------- Render ----------
  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-5 flex items-center gap-6">
            <div className="relative"><ProgressRing progress={stats.todayTotal?(stats.completedToday/stats.todayTotal)*100:0} size={80}/><span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{stats.todayTotal?Math.round((stats.completedToday/stats.todayTotal)*100):0}%</span></div>
            <div><h2 className="text-lg font-bold">Today's Mission</h2><p className="text-sm text-muted-foreground">{stats.completedToday} of {stats.todayTotal} completed</p><div className="mt-1 flex items-center gap-2 text-xs"><span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400"/> {stats.streak} day streak</span><span className="flex items-center gap-1 text-neon-pink"><AlertCircle className="h-3 w-3"/> {stats.overdue} overdue</span></div></div>
          </GlassCard>
          <GlassCard className="p-5"><h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">This Week</h3><WeeklyChart completedByDay={stats.weekly}/></GlassCard>
          <GlassCard className="p-5"><div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-neon-purple"/><span className="text-sm font-semibold">AI Coach</span></div><p className="text-xs text-muted-foreground">{isCoachLoading?"Analyzing your current rhythm...":insight}</p><div className="mt-3 flex gap-2 text-[10px]"><span className="glass px-2 py-1 rounded-full">⏰ Best time: {coachData?.mostProductiveHour??"Morning"}</span><span className="glass px-2 py-1 rounded-full">⚡ {coachData?.weakArea??"High energy tasks first"}</span></div></GlassCard>
        </div>

        <AiCommandPanel onSubmit={handleAiCommand} isLoading={isProcessing} />
        <AiQuickActions onAction={handleQuickAction} isLoading={isProcessing} />
        <AiCoachCard completionRate={stats.completionRate} mostProductiveHour={coachData?.mostProductiveHour} weakArea={coachData?.weakArea} suggestion={coachData?.suggestion} tasksCompletedThisWeek={stats.completed} streakCount={stats.streak} />

        {overdue.length>0 && viewMode==="list" && (
          <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-neon-pink"><AlertCircle className="h-4 w-4"/> Overdue ({overdue.length})</div><div className="space-y-2">{overdue.map(task=><TaskCard key={task.id} task={task} onToggle={()=>toggleTask(task.id)} onDelete={()=>deleteTask(task.id)} onEdit={()=>setEditingTaskId(task.id)}/>)}</div></div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]"><Search className="h-4 w-4 text-muted-foreground"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search tasks..." className="bg-transparent outline-none text-sm flex-1"/></div>
          <div className="flex gap-1">{(["all","today","pending","done","high"] as FilterType[]).map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs capitalize ${filter===f?"bg-gradient-primary text-white glow-soft":"glass text-muted-foreground hover:text-foreground"}`}>{f}</button>)}</div>
          <select value={groupBy} onChange={e=>setGroupBy(e.target.value as GroupBy)} className="glass rounded-lg px-3 py-1.5 text-xs outline-none"><option value="category">Group: Category</option><option value="dueDate">Group: Due Date</option><option value="priority">Group: Priority</option></select>
          <div className="glass rounded-lg flex p-0.5"><button onClick={()=>setViewMode("list")} className={`p-1.5 rounded-md ${viewMode==="list"?"bg-white/10":""}`}><List className="h-4 w-4"/></button><button onClick={()=>setViewMode("board")} className={`p-1.5 rounded-md ${viewMode==="board"?"bg-white/10":""}`}><Columns className="h-4 w-4"/></button></div>
          <button onClick={()=>setShowQuickAdd(prev=>!prev)} className="flex items-center gap-1 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-medium text-white glow-soft"><Plus className="h-3.5 w-3.5"/> Quick Add</button>
        </div>

        <AnimatePresence>{showQuickAdd && <GlassCard className="p-4"><QuickAddForm onClose={()=>setShowQuickAdd(false)}/></GlassCard>}</AnimatePresence>

        {viewMode==="list"?(
          <div className="space-y-6">{groups.sortedKeys.map(key=><div key={key}><div className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground uppercase"><div className="h-px flex-1 bg-white/10"/>{key}<div className="h-px flex-1 bg-white/10"/></div><div className="space-y-2">{groups.groupsMap[key].map(task=><TaskCard key={task.id} task={task} onToggle={()=>toggleTask(task.id)} onDelete={()=>deleteTask(task.id)} onEdit={()=>setEditingTaskId(task.id)}/>)}</div></div>)}
          {rest.length===0 && overdue.length===0 && <div className="text-center py-12 text-muted-foreground">No missions found. Create your first one!</div>}</div>
        ):(
          <div className="space-y-4">
            {overdue.length>0 && <div className="glass rounded-2xl p-4 border border-neon-pink/20"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm text-neon-pink">Overdue ({overdue.length})</h3><button type="button" onClick={()=>handleAiCommand("Reschedule all overdue tasks")} className="inline-flex items-center gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 text-xs font-medium text-neon-pink"><RefreshCw className="h-3.5 w-3.5"/> Rebalance</button></div><div className="space-y-2">{overdue.map(task=><TaskCard key={task.id} task={task} onToggle={()=>toggleTask(task.id)} onDelete={()=>deleteTask(task.id)} onEdit={()=>setEditingTaskId(task.id)} compact/>)}</div></div>}
            <div className="flex flex-wrap gap-4">{Object.entries(boardCols).map(([col, tasks])=><div key={col} className="glass rounded-xl p-4 flex-1 min-w-[250px] max-w-[400px]"><h3 className="font-semibold text-sm mb-3">{col} ({tasks.length})</h3><div className="space-y-2">{tasks.map(task=><TaskCard key={task.id} task={task} onToggle={()=>toggleTask(task.id)} onDelete={()=>deleteTask(task.id)} onEdit={()=>setEditingTaskId(task.id)} compact/>)}</div></div>)}</div>
          </div>
        )}

        <TaskEditorDialog task={editingTask} open={Boolean(editingTask)} onOpenChange={open=>{if(!open) setEditingTaskId(null);}} onSave={patch=>{if(editingTask) updateTask(editingTask.id,patch);}} onDelete={()=>{if(editingTask){ deleteTask(editingTask.id); setEditingTaskId(null); }}} />
        <PlanConfirmation plan={generatedPlan} isOpen={showPlanConfirmation} isLoading={isProcessing} onConfirm={handleConfirmPlan} onCancel={()=>setShowPlanConfirmation(false)} />
      </div>
    </AppShell>
  );
}