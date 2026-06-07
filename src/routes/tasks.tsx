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
import { formatLocalDate, startOfLocalDay } from "@/lib/date";
import { buildLocalRoadmapFallback } from "@/lib/ai/task-command-local";
import { extractRoadmapSource } from "@/lib/api/roadmap-source.functions";
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
  PencilLine,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const priorityConfig = {
  high: { color: "bg-neon-pink", label: "High" },
  medium: { color: "bg-neon-purple", label: "Medium" },
  low: { color: "bg-neon-blue", label: "Low" },
} as const;

type ViewMode = "list" | "board";
type FilterType = "all" | "today" | "pending" | "done" | "high";
type GroupBy = "category" | "dueDate" | "priority";
const DAY_MS = 24 * 60 * 60 * 1000;
const AI_TAG = "ai-generated";

type TaskInput = Omit<Task, "id" | "createdAt" | "completed">;

type TaskFormState = {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  focusMinutes: number;
  category: string;
  tagsInput: string;
  completed: boolean;
};

type PlannedItem = {
  title: string;
  durationMinutes: number;
  note?: string;
};

type ParsedPlanResult = {
  plan: GeneratedPlan;
  tasks: TaskInput[];
};
type RescheduleGroupSummary = {
  key: string;
  taskCount: number;
  totalMinutes: number;
  scheduledDays: number;
  firstDueDate: string;
  lastDueDate: string;
};

type RescheduleResult = {
  moved: number;
  summary: string;
  warning?: string;
  groups: RescheduleGroupSummary[];
};

const DEFAULT_DAILY_CAPACITY_MINUTES = 120;
const DEFAULT_RESCHEDULE_DAYS = 7;

function normalizeTagValue(tag: string) {
  return tag.replace(/^#/, "").trim().toLowerCase();
}

function titleCase(value: string) {
  const cleaned = value
    .replace(/^(course|playlist|group|module):/i, "")
    .replace(/^#/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!cleaned) return "Uncategorized";
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOverdueGroupKey(task: Task) {
  const explicitGroupTag = task.tags?.find((tag) => {
    const normalized = normalizeTagValue(tag);
    return (
      normalized.startsWith("course:") ||
      normalized.startsWith("playlist:") ||
      normalized.startsWith("group:") ||
      normalized.startsWith("module:")
    );
  });

  if (explicitGroupTag) {
    return normalizeTagValue(explicitGroupTag);
  }

  const firstUsefulTag = task.tags?.find(
    (tag) => normalizeTagValue(tag) !== "ai-generated"
  );

  if (firstUsefulTag) return normalizeTagValue(firstUsefulTag);

  return task.category?.trim() || "Uncategorized";
}

function formatMinutesHuman(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}


function shiftDate(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toTimeMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToClock(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60
  ).padStart(2, "0")}`;
}

function formatTimeInput(value?: string) {
  return value?.slice(0, 5) ?? "";
}

function parseTagsInput(input: string) {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function clampMinutes(value: number, min = 15, max = 240) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function extractTargetDays(command: string, fallback: number) {
  const lower = command.toLowerCase();

  // "today" or "complete today" → 1 day
  if (/\btoday\b/.test(lower)) return 1;

  // "tomorrow" → 2 days (today + tomorrow)
  if (/\btomorrow\b/.test(lower)) return 2;

  const daysMatch = lower.match(/(\d+)\s*(days?|day)\b/);
  if (daysMatch) return Math.max(1, Number(daysMatch[1]));

  const weeksMatch = lower.match(/(\d+)\s*(weeks?|week)\b/);
  if (weeksMatch) return Math.max(1, Number(weeksMatch[1]) * 7);

  const monthsMatch = lower.match(/(\d+)\s*(months?|month)\b/);
  if (monthsMatch) return Math.max(1, Number(monthsMatch[1]) * 30);

  const byIsoDateMatch = lower.match(/\bby\s+(\d{4}-\d{2}-\d{2})\b/);
  if (byIsoDateMatch) {
    const target = new Date(`${byIsoDateMatch[1]}T00:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
      return Math.max(1, diff + 1);
    }
  }

  return Math.max(1, fallback);
}

function estimateItemMinutes(text: string) {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min|m)\b/i
  );
  if (!match) return 45;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("hour") || unit.startsWith("hr")) {
    return clampMinutes(value * 60, 15, 240);
  }
  return clampMinutes(value, 5, 240);
}

function cleanLineItem(line: string) {
  return line
    .replace(/^(?:[-*•]\s+|\d+[.)]\s+|[>]\s+)/, "")
    .trim();
}

function buildTaskForm(task?: Task | null): TaskFormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ?? "",
    dueTime: formatTimeInput(task?.dueTime),
    focusMinutes: task?.focusMinutes ?? 30,
    category: task?.category ?? "General",
    tagsInput: task?.tags?.join(", ") ?? "",
    completed: task?.completed ?? false,
  };
}

function isTaskOverdue(task: Task, now = new Date()) {
  if (task.completed || !task.dueDate) return false;

  const dueDate = new Date(`${task.dueDate}T00:00:00`);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (dueDate < todayStart) return true;
  if (dueDate > todayStart) return false;

  const dueMinutes = toTimeMinutes(task.dueTime);
  return dueMinutes != null && now.getHours() * 60 + now.getMinutes() > dueMinutes;
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

function calculateCompletionStreak(tasks: Task[], referenceDate: string) {
  const completedDates = new Set(
    tasks
      .filter((t) => t.completedAt)
      .map((t) => formatLocalDate(new Date(t.completedAt as string)))
  );

  const cursor = startOfLocalDay();
  let streak = 0;

  // Start from the current day in the app, not only from the current machine time.
  while (completedDates.has(formatLocalDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // If today is not completed but yesterday was, the streak logic above still works.
  // referenceDate is kept for future flexibility and to keep the function deterministic.
  void referenceDate;

  return streak;
}

/**
 * Detect & parse a YouTube playlist paste.
 * YouTube format per video:
 *   <number>           e.g. "54"
 *   true|false          checkbox state
 *   <duration>          e.g. "22:22" or "1:21:46"
 *   Now playing         status line
 *   <actual title>      the real video title
 *   (blank line)
 */
function parseYouTubePaste(lines: string[]): PlannedItem[] | null {
  // Heuristic: at least 3 occurrences of the YouTube metadata pattern
  const durationPattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
  const metadataLines = lines.filter(
    (l) => /^(true|false)$/i.test(l) || durationPattern.test(l) || /^now playing$/i.test(l)
  );
  if (metadataLines.length < 3) return null;

  const items: PlannedItem[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Try to find the pattern: number → true/false → duration → "Now playing" → title
    if (/^\d+$/.test(line) && i + 4 < lines.length) {
      const boolLine = lines[i + 1];
      const durationLine = lines[i + 2];
      const statusLine = lines[i + 3];
      const titleLine = lines[i + 4];

      if (
        /^(true|false)$/i.test(boolLine) &&
        durationPattern.test(durationLine) &&
        /^now playing$/i.test(statusLine) &&
        titleLine.length > 3
      ) {
        // Parse duration like "22:22" or "1:21:46"
        const parts = durationLine.split(":").map(Number);
        let totalMinutes = 0;
        if (parts.length === 3) {
          totalMinutes = parts[0] * 60 + parts[1] + Math.ceil(parts[2] / 60);
        } else if (parts.length === 2) {
          totalMinutes = parts[0] + Math.ceil(parts[1] / 60);
        }
        totalMinutes = Math.max(5, totalMinutes);

        items.push({
          title: titleLine,
          durationMinutes: totalMinutes,
        });
        i += 5; // skip past this block
        continue;
      }
    }
    i++;
  }
  return items.length > 0 ? items : null;
}

function parsePastedList(command: string): PlannedItem[] {
  const lines = command
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // First try YouTube playlist format detection
  const ytItems = parseYouTubePaste(lines);
  if (ytItems) return ytItems;

  // Fallback: bullet-list or plain-list parsing
  const bulletLike = lines.filter((line) =>
    /^(?:[-*•]|\d+[.)])\s+/.test(line)
  );

  const candidateLines = bulletLike.length > 0 ? bulletLike : lines;

  // Filter out YouTube-like garbage even in fallback mode
  const junkPattern = /^(true|false|now playing|\d{1,2}:\d{2}(:\d{2})?)$/i;

  const items = candidateLines
    .map((line) => cleanLineItem(line))
    .filter(
      (line) =>
        line.length > 3 &&
        !/^https?:\/\//i.test(line) &&
        !junkPattern.test(line) &&
        !/^\d+$/.test(line) &&
        !/^want\s+to\s+complet/i.test(line)
    )
    .map((line) => ({
      title: line,
      durationMinutes: estimateItemMinutes(line),
    }));

  return items;
}

function bucketItemsByMinutes(items: PlannedItem[], targetDays: number) {
  if (items.length === 0) return [];

  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const dailyBudget = Math.max(30, Math.ceil(totalMinutes / Math.max(1, targetDays)));

  const buckets: PlannedItem[][] = [];
  let current: PlannedItem[] = [];
  let usedMinutes = 0;

  items.forEach((item, index) => {
    const minutes = clampMinutes(item.durationMinutes, 5, 240);
    const wouldOverflow =
      current.length > 0 && usedMinutes + minutes > dailyBudget && buckets.length < targetDays - 1;

    if (wouldOverflow) {
      buckets.push(current);
      current = [];
      usedMinutes = 0;
    }

    current.push({ ...item, durationMinutes: minutes });
    usedMinutes += minutes;

    if (index === items.length - 1 && current.length > 0) {
      buckets.push(current);
    }
  });

  return buckets.length > 0 ? buckets : [items];
}

function buildPlanFromItems(params: {
  title: string;
  description: string;
  targetDays: number;
  items: PlannedItem[];
  startDate: string;
  category?: string;
  tag?: string;
  preferredStudyHours?: { start: string; end: string };
}): ParsedPlanResult | null {
  const {
    title,
    description,
    targetDays,
    items,
    startDate,
    category = "Study",
    tag = AI_TAG,
    preferredStudyHours,
  } = params;

  void preferredStudyHours; // kept for API compat

  if (items.length === 0) return null;

  const buckets = bucketItemsByMinutes(items, targetDays);

  const plan: GeneratedPlan = {
    title,
    description,
    duration: `${Math.max(1, buckets.length)} day${buckets.length > 1 ? "s" : ""}`,
    estimatedCommitment: `${Math.round(
      items.reduce((sum, item) => sum + item.durationMinutes, 0) /
        Math.max(1, buckets.length)
    )} min/day`,
    totalTasks: items.length,
    items: buckets.map((bucket, dayIndex) => ({
      phase: `Day ${dayIndex + 1}`,
      description:
        bucket.length === 1
          ? `${bucket[0].title}`
          : `${bucket.length} items · ${bucket[0].title}${
              bucket.length > 1 ? ` +${bucket.length - 1} more` : ""
            }`,
      taskCount: bucket.length,
      taskTitles: bucket.map((item) => item.title),
      taskDurationsMinutes: bucket.map((item) => item.durationMinutes),
    })),
  };

  const startDateObj = new Date(`${startDate}T00:00:00`);

  const tasks: TaskInput[] = buckets.flatMap((bucket, dayIndex) => {
    const dueDate = formatLocalDate(shiftDate(startDateObj, dayIndex));

    return bucket.map((item) => {
      const focusMinutes = clampMinutes(item.durationMinutes, 5, 240);

      const draft: TaskInput = {
        title: item.title,
        description: item.note,
        priority: "medium",
        dueDate,
        tags: [tag],
        focusMinutes,
        category,
      };

      return draft;
    });
  });

  return { plan, tasks };
}

function buildRoadmapFromText(command: string, startDate: string) {
  const items = parsePastedList(command);
  if (items.length === 0) return null;

  const targetDays = extractTargetDays(
    command,
    Math.max(1, Math.ceil(items.length / 5))
  );

  const title =
    items.length === 1
      ? items[0].title
      : "Task Roadmap";

  const description = `${items.length} item${
    items.length > 1 ? "s" : ""
  } scheduled over ${targetDays} day${targetDays > 1 ? "s" : ""}.`;

  return buildPlanFromItems({
    title,
    description,
    targetDays,
    items,
    startDate,
    category: "Study",
    tag: AI_TAG,
  });
}

function buildRoadmapFromPlaylist(
  source: { title?: string; items: { title: string; durationMinutes: number | null }[] },
  command: string,
  startDate: string,
  preferredStudyHours?: { start: string; end: string }
) {
  const items: PlannedItem[] = source.items
    .filter((item) => item.title.trim().length > 0)
    .map((item) => ({
      title: item.title.trim(),
      durationMinutes: clampMinutes(item.durationMinutes ?? 45, 5, 240),
    }));

  if (items.length === 0) return null;

  const targetDays = extractTargetDays(command, 30);

  const title = source.title?.trim() || "YouTube Playlist Roadmap";
  const description = `${items.length} video${items.length > 1 ? "s" : ""} scheduled over ${targetDays} day${targetDays > 1 ? "s" : ""}.`;

  return buildPlanFromItems({
    title,
    description,
    targetDays,
    items,
    startDate,
    category: "Study",
    tag: "playlist",
    preferredStudyHours,
  });
}

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
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(30);
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      focusMinutes: clampMinutes(Number(focusMinutes) || 30, 5, 480),
      category: category.trim() || "General",
      tags: parseTagsInput(tagsInput),
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
    });

    setTitle("");
    setPriority("medium");
    setDueDate("");
    setDueTime("");
    setFocusMinutes(30);
    setCategory("General");
    setTagsInput("");
    setDescription("");
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

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description"
        className="glass w-full min-h-[72px] rounded-lg px-3 py-2 text-xs outline-none resize-none"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="glass rounded-lg px-2 py-1.5 text-xs outline-none"
        />

        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
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
  task: Task;
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
      className={`group glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition ${
        task.completed ? "opacity-70" : ""
      }`}
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
          className={`font-medium text-sm ${
            task.completed ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {formatDueStatus(task)}
            </span>
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ${
                  isTaskOverdue(task) ? "text-neon-pink" : ""
                }`}
              >
                <Calendar className="h-3 w-3" />
                {formatDueLabel(task)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.focusMinutes}m
            </span>
            {task.description && (
              <span className="glass px-1.5 py-0.5 rounded-full text-[10px] max-w-[220px] truncate">
                {task.description}
              </span>
            )}
            {task.tags?.slice(0, 2).map((t) => (
              <span key={t} className="glass px-1.5 py-0.5 rounded-full text-[10px]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-neon-cyan">
          <PencilLine className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-neon-pink">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function TaskEditorDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<TaskFormState>(() => buildTaskForm(task));

  useEffect(() => {
    setForm(buildTaskForm(task));
  }, [task]);

  if (!task) return null;

  const updateField = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      dueTime: form.dueTime || undefined,
      focusMinutes: clampMinutes(Number(form.focusMinutes) || 30, 5, 480),
      category: form.category.trim() || "General",
      tags: parseTagsInput(form.tagsInput),
      completed: form.completed,
      completedAt: form.completed
        ? task.completedAt ?? new Date().toISOString()
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-4 w-4 text-neon-cyan" />
            Edit Task
          </DialogTitle>
          <DialogDescription>Refine any detail manually.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Category</label>
              <input
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="glass w-full min-h-[96px] rounded-xl px-3 py-2 text-sm outline-none resize-none"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateField("priority", e.target.value as Priority)}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Due date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => updateField("dueDate", e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Due time</label>
              <input
                type="time"
                value={form.dueTime}
                onChange={(e) => updateField("dueTime", e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Focus mins</label>
              <input
                type="number"
                min={5}
                max={480}
                value={form.focusMinutes}
                onChange={(e) => updateField("focusMinutes", Number(e.target.value))}
                className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Tags</label>
            <input
              value={form.tagsInput}
              onChange={(e) => updateField("tagsInput", e.target.value)}
              placeholder="study, course, urgent"
              className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Completion state</p>
              <p className="text-xs text-muted-foreground">
                {form.completed ? "This task is marked as complete." : "This task is still active."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField("completed", !form.completed)}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                form.completed
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                  : "bg-white/10 text-white border border-white/10"
              }`}
            >
              {form.completed ? "Mark active" : "Mark complete"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-neon-pink/30 bg-neon-pink/10 px-4 py-2 text-sm font-medium text-neon-pink"
            >
              Delete task
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-medium text-white glow-soft"
            >
              Save changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    addTask,
    batchAddTasks,
    addGoal,
    toggleTask,
    deleteTask,
    updateTask,
    addAssistantMessage,
    userName,
  } = useStore();

  const [now, setNow] = useState(() => new Date());
  const todayStr = useMemo(() => formatLocalDate(now), [now]);

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
  const [coachData, setCoachData] = useState<{
    mostProductiveHour: string;
    weakArea: string;
    suggestion: string;
  } | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [rescheduleSummary, setRescheduleSummary] = useState<string | null>(null);
  const [showReschedulePrompt, setShowReschedulePrompt] = useState(false);

  const coachSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const todayTasks = tasks.filter((t) => t.dueDate === todayStr);
    const completedToday = todayTasks.filter((t) => t.completed).length;
    const overdue = tasks.filter((t) => isTaskOverdue(t, now)).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const streak = calculateCompletionStreak(tasks, todayStr);

    const weekly = new Array(7).fill(0);
    const base = new Date(`${todayStr}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const ds = formatLocalDate(shiftDate(base, -(6 - i)));
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
  }, [tasks, todayStr, now]);

  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingTaskId) ?? null,
    [editingTaskId, tasks]
  );

  const focusToday = useMemo(
    () => focusSessions.find((s) => s.date === todayStr)?.minutes ?? 0,
    [focusSessions, todayStr]
  );

  const rescheduleDailyCapacity = useMemo(() => {
    const start = toTimeMinutes(lifeContext.preferredStudyHours.start) ?? 540;
    const end = toTimeMinutes(lifeContext.preferredStudyHours.end);

    const windowMinutes =
      end != null
        ? end > start
          ? end - start
          : 24 * 60 - start + end
        : DEFAULT_DAILY_CAPACITY_MINUTES;

    return Math.max(
      60,
      Math.min(DEFAULT_DAILY_CAPACITY_MINUTES, windowMinutes || DEFAULT_DAILY_CAPACITY_MINUTES)
    );
  }, [lifeContext.preferredStudyHours]);

  const overdueGroups = useMemo(() => {
    const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now));

    const map = new Map<string, { tasks: Task[]; totalMinutes: number }>();

    overdueTasks.forEach((task) => {
      const key = getOverdueGroupKey(task);
      const current = map.get(key) ?? { tasks: [], totalMinutes: 0 };
      const minutes = clampMinutes(task.focusMinutes || 30, 15, 240);

      current.tasks.push(task);
      current.totalMinutes += minutes;
      map.set(key, current);
    });

    return [...map.entries()]
      .map(([key, value]) => ({
        key,
        tasks: value.tasks.sort(
          (a, b) =>
            (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
            a.createdAt.localeCompare(b.createdAt)
        ),
        totalMinutes: value.totalMinutes,
      }))
      .sort(
        (a, b) =>
          (a.tasks[0]?.dueDate ?? "").localeCompare(b.tasks[0]?.dueDate ?? "") ||
          a.tasks[0].createdAt.localeCompare(b.tasks[0].createdAt) ||
          b.totalMinutes - a.totalMinutes
      );
  }, [tasks, now]);

const rescheduleOverdueTasks = useCallback((strategy: "extend_deadline" | "increase_load" = "extend_deadline"): RescheduleResult => {
  // Find tasks that are actually overdue
  const strictlyOverdueTasks = tasks.filter((t) => isTaskOverdue(t, now));
  
  if (strictlyOverdueTasks.length === 0) {
    const message = "No overdue tasks found.";
    setRescheduleSummary(message);
    window.setTimeout(() => setRescheduleSummary(null), 5000);
    return { moved: 0, summary: message, groups: [] };
  }

  // Get the group keys (courses/categories) that have at least one overdue task
  const overdueGroupKeys = new Set(strictlyOverdueTasks.map(getOverdueGroupKey));

  // Collect ALL incomplete tasks that belong to those overdue groups
  const allTasksToReschedule = tasks
    .filter((t) => !t.completed && overdueGroupKeys.has(getOverdueGroupKey(t)))
    .sort(
      (a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
        a.createdAt.localeCompare(b.createdAt)
    );

  const totalMinutes = allTasksToReschedule.reduce(
    (sum, task) => sum + clampMinutes(task.focusMinutes || 30, 15, 240),
    0
  );

  let plannedDays = 1;
  if (strategy === "increase_load") {
    let maxDate = todayStr;
    for (const t of allTasksToReschedule) {
      if (t.dueDate && t.dueDate > maxDate) maxDate = t.dueDate;
    }
    const msDiff = new Date(maxDate).getTime() - new Date(todayStr).getTime();
    plannedDays = Math.max(1, Math.ceil(msDiff / (1000 * 3600 * 24)) + 1);
  } else {
    plannedDays = Math.max(
      DEFAULT_RESCHEDULE_DAYS,
      Math.ceil(totalMinutes / rescheduleDailyCapacity)
    );
  }

  const dynamicCapacity = strategy === "increase_load" 
    ? Math.max(15, Math.ceil(totalMinutes / plannedDays)) 
    : rescheduleDailyCapacity;

  const startDate = new Date(`${todayStr}T00:00:00`);
  const dayBuckets = Array.from({ length: plannedDays }, (_, index) => ({
    date: shiftDate(startDate, index),
    usedMinutes: 0,
  }));

  const grouped = new Map<string, Task[]>();
  for (const task of allTasksToReschedule) {
    const key = getOverdueGroupKey(task);
    const list = grouped.get(key) ?? [];
    list.push(task);
    grouped.set(key, list);
  }

  const groupEntries = [...grouped.entries()]
    .map(([key, list]) => ({
      key,
      tasks: list.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          a.createdAt.localeCompare(b.createdAt)
      ),
      totalMinutes: list.reduce(
        (sum, task) => sum + clampMinutes(task.focusMinutes || 30, 15, 240),
        0
      ),
    }))
    .sort(
      (a, b) =>
        (a.tasks[0]?.dueDate ?? "").localeCompare(b.tasks[0]?.dueDate ?? "") ||
        a.tasks[0].createdAt.localeCompare(b.tasks[0].createdAt) ||
        b.totalMinutes - a.totalMinutes
    );

  const groupSummaries: RescheduleResult["groups"] = [];
  let moved = 0;
  let extendedDeadline = false;

  for (const group of groupEntries) {
    const groupTargetPerDay = Math.max(1, group.totalMinutes / dayBuckets.length);
    let progressMinutes = 0;
    const usedDays = new Set<number>();
    let firstDueDate = "";
    let lastDueDate = "";

    for (const task of group.tasks) {
      const effort = clampMinutes(task.focusMinutes || 30, 15, 240);
      const idealDay = Math.min(
        dayBuckets.length - 1,
        Math.floor(progressMinutes / groupTargetPerDay)
      );

      let scheduledIndex = -1;

      for (let index = idealDay; index < dayBuckets.length; index++) {
        if (dayBuckets[index].usedMinutes + effort <= dynamicCapacity) {
          scheduledIndex = index;
          break;
        }
      }

      while (scheduledIndex === -1) {
        if (strategy === "increase_load") {
          // Force into the least full bucket or idealDay if we run out of space, 
          // but we shouldn't because dynamicCapacity is calculated to fit everything.
          // Fallback just in case floating point/ceiling math leaves a remainder:
          scheduledIndex = Math.min(dayBuckets.length - 1, idealDay);
          break;
        }

        dayBuckets.push({
          date: shiftDate(dayBuckets[dayBuckets.length - 1].date, 1),
          usedMinutes: 0,
        });
        extendedDeadline = true;
        scheduledIndex = dayBuckets.length - 1;
        if (dayBuckets[scheduledIndex].usedMinutes + effort <= dynamicCapacity) {
          break;
        }
      }

      const bucket = dayBuckets[scheduledIndex];
      const dueDate = formatLocalDate(bucket.date);
      // Do not force a dueTime. This avoids tasks scheduled for today becoming 
      // immediately overdue if the calculated time is in the past.
      updateTask(task.id, { dueDate, dueTime: undefined });

      bucket.usedMinutes += effort;
      progressMinutes += effort;
      usedDays.add(scheduledIndex);
      if (!firstDueDate) firstDueDate = dueDate;
      lastDueDate = dueDate;
      moved++;
    }

    groupSummaries.push({
      key: group.key,
      taskCount: group.tasks.length,
      totalMinutes: group.totalMinutes,
      scheduledDays: usedDays.size,
      firstDueDate,
      lastDueDate,
    });
  }

  const finalDeadline = formatLocalDate(dayBuckets[dayBuckets.length - 1].date);

  const groupText = groupSummaries
    .map(
      (group) =>
        `${titleCase(group.key)}: ${group.taskCount} task${group.taskCount === 1 ? "" : "s"}, ${formatMinutesHuman(group.totalMinutes)} total, spread across ${group.scheduledDays} day${group.scheduledDays === 1 ? "" : "s"}`
    )
    .join("\n");

  const summary = [
    `Rescheduled ${moved} task${moved === 1 ? "" : "s"} across ${dayBuckets.length} day${dayBuckets.length === 1 ? "" : "s"} (${formatMinutesHuman(dynamicCapacity)}/day). New deadline: ${finalDeadline}.`,
    groupText,
    extendedDeadline
      ? "Workload exceeded the initial 7-day window, so the deadline was extended automatically."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  setRescheduleSummary(summary);
  window.setTimeout(() => setRescheduleSummary(null), 7000);

  return {
    moved,
    summary,
    warning: extendedDeadline
      ? "Deadline extended automatically because the workload did not fit in the first 7-day window."
      : undefined,
    groups: groupSummaries,
  };
}, [
  lifeContext.preferredStudyHours.start,
  now,
  rescheduleDailyCapacity,
  tasks,
  todayStr,
  updateTask,
]);

  const coachContext = useMemo<AiContext>(
    () => ({
      userName,
      today: todayStr,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        priority: t.priority,
        category: t.category,
        focusMinutes: t.focusMinutes,
        tags: t.tags,
        completed: t.completed,
      })),
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        doneToday: Boolean(h.history[todayStr]),
      })),
      focusToday,
      streakCount: stats.streak,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        deadline: g.deadline,
        category: g.category,
        status: g.status,
      })),
      lifeContext: {
        collegeTimetable: lifeContext.collegeTimetable.map((e) => ({
          day: e.day,
          start: e.start,
          end: e.end,
          label: e.label,
        })),
        exams: lifeContext.exams.map((e) => ({ title: e.title, date: e.date, course: e.course })),
        internships: lifeContext.internships.map((i) => ({
          company: i.company,
          role: i.role,
          startDate: i.startDate,
          endDate: i.endDate,
          status: i.status,
        })),
        sleepSchedule: lifeContext.sleepSchedule,
        preferredStudyHours: lifeContext.preferredStudyHours,
        placementGoals: lifeContext.placementGoals,
      },
      recentMessages: assistantMessages.slice(-12).map((m) => ({ role: m.role, text: m.text })),
      playlistImports: playlistImports.map((p) => ({ id: p.id, title: p.title, items: p.items })),
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
      todayStr,
      userName,
    ]
  );

  const taskCommandContext = useMemo<AiContext>(
    () => ({
      userName,
      today: todayStr,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        priority: t.priority,
        category: t.category,
        focusMinutes: t.focusMinutes,
        tags: t.tags,
        completed: t.completed,
      })),
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        doneToday: Boolean(h.history[todayStr]),
      })),
      focusToday,
      streakCount: stats.streak,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        deadline: g.deadline,
        category: g.category,
        status: g.status,
      })),
      lifeContext: {
        collegeTimetable: lifeContext.collegeTimetable.map((e) => ({
          day: e.day,
          start: e.start,
          end: e.end,
          label: e.label,
        })),
        exams: lifeContext.exams.map((e) => ({ title: e.title, date: e.date, course: e.course })),
        internships: lifeContext.internships.map((i) => ({
          company: i.company,
          role: i.role,
          startDate: i.startDate,
          endDate: i.endDate,
          status: i.status,
        })),
        sleepSchedule: lifeContext.sleepSchedule,
        preferredStudyHours: lifeContext.preferredStudyHours,
        placementGoals: lifeContext.placementGoals,
      },
      recentMessages: assistantMessages.slice(-12).map((m) => ({ role: m.role, text: m.text })),
      playlistImports: playlistImports.map((p) => ({ id: p.id, title: p.title, items: p.items })),
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
      todayStr,
      userName,
    ]
  );

  const handlePastedListCommand = useCallback(
    (command: string) => {
      const items = parsePastedList(command);
      if (items.length === 0) return null;

      const targetDays = extractTargetDays(
        command,
        Math.max(1, Math.ceil(items.length / 5))
      );

      const title = items.length === 1 ? items[0].title : "Task Roadmap";
      const description = `${items.length} item${
        items.length > 1 ? "s" : ""
      } scheduled over ${targetDays} day${targetDays > 1 ? "s" : ""}.`;

      return buildPlanFromItems({
        title,
        description,
        targetDays,
        items,
        startDate: todayStr,
        category: "Study",
        tag: AI_TAG,
        preferredStudyHours: lifeContext.preferredStudyHours,
      });
    },
    [lifeContext.preferredStudyHours, todayStr]
  );

  const handleYouTubePlaylistCommand = useCallback(
    async (command: string) => {
      const urlMatch = command.match(/(https?:\/\/[^\s]+)/i);
      if (!urlMatch) return null;

      const url = urlMatch[0];
      const source = await extractRoadmapSource({ data: { input: url } }).catch((err) => {
        console.error("Playlist fetch failed:", err);
        return null;
      });

      if (!source || !source.items || source.items.length === 0) return null;

      return buildRoadmapFromPlaylist(source, command, todayStr, lifeContext.preferredStudyHours);
    },
    [lifeContext.preferredStudyHours, todayStr]
  );

  const handleAiCommand = useCallback(
    async (command: string) => {
      setIsProcessing(true);
      addAssistantMessage({ role: "user", text: command });

      try {
        const pastedPlan = handlePastedListCommand(command);
        if (pastedPlan) {
          setGeneratedPlan(pastedPlan.plan);
          setPendingTasks(pastedPlan.tasks);
          setShowPlanConfirmation(true);
          addAssistantMessage({
            role: "ai",
            text: `Parsed ${pastedPlan.tasks.length} items into a day-wise plan. Review and confirm to add them.`,
          });
          return;
        }

        const playlistPlan = await handleYouTubePlaylistCommand(command);
        if (playlistPlan) {
          setGeneratedPlan(playlistPlan.plan);
          setPendingTasks(playlistPlan.tasks);
          setShowPlanConfirmation(true);
          addAssistantMessage({
            role: "ai",
            text: `Prepared a ${playlistPlan.plan.duration} plan from the playlist. Review and confirm to add ${playlistPlan.tasks.length} tasks.`,
          });
          return;
        }

        const parsed = parseCommand(command);

        if (parsed.intent === "reschedule") {
          const result = rescheduleOverdueTasks();
          addAssistantMessage({ role: "ai", text: result.summary });
          return;
        }

        if (parsed.intent === "plan_day") {
          const response = await planDay(command, taskCommandContext);
          addAssistantMessage({ role: "ai", text: response });
          return;
        }

        if (parsed.intent === "plan_week") {
          const response = await askAssistant({
            data: {
              message:
                "Create a concise, actionable weekly plan from my current tasks, overdue work, goals, and study window.",
              context: taskCommandContext,
            },
          });
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

        if (
          /\b(edit|update|change|delete|remove|rename|complete|finish)\b/i.test(command) &&
          !/\b(create|make|build|plan)\b/i.test(command)
        ) {
          addAssistantMessage({
            role: "ai",
            text: "Pick a task card to edit, or tell me the exact task title and change.",
          });
          return;
        }

        const looksLikeTaskCrud =
          /\b(add|create|make|build|edit|update|change|delete|remove|rename|complete|finish|schedule|postpone|move)\b/i.test(
            command
          ) || /\b(task|tasks|todo|to-do|schedule)\b/i.test(command);

        if (looksLikeTaskCrud) {
          try {
            const response = await askAssistant({
              data: { message: command, context: taskCommandContext },
            });

            if (response.actions?.length) {
              const applied = applyAiActions(response.actions, {
                addTask,
                batchAddTasks,
                updateTask,
                deleteTask,
                addGoal,
              });

              addAssistantMessage({
                role: "ai",
                text: `Applied ${applied} task change${applied === 1 ? "" : "s"}. ${response.response}`.trim(),
              });
            } else {
              addAssistantMessage({ role: "ai", text: response.response });
            }
          } catch {
            const fallback = buildLocalRoadmapFallback(command, taskCommandContext);
            setGeneratedPlan(fallback.plan);
            setPendingTasks(fallback.tasks);
            setShowPlanConfirmation(true);
            addAssistantMessage({
              role: "ai",
              text: `Local roadmap prepared: "${fallback.plan.title}".`,
            });
          }
          return;
        }

        try {
          const { plan, tasks: plannedTasks } = await generateTaskPlan(command, taskCommandContext);
          setGeneratedPlan(plan);
          setPendingTasks(plannedTasks);
          setShowPlanConfirmation(true);
          addAssistantMessage({
            role: "ai",
            text: `Created a ${plan.duration ?? "custom"} roadmap for "${plan.title}".`,
          });
        } catch {
          const fallback = buildLocalRoadmapFallback(command, taskCommandContext);
          setGeneratedPlan(fallback.plan);
          setPendingTasks(fallback.tasks);
          setShowPlanConfirmation(true);
          addAssistantMessage({
            role: "ai",
            text: `Local roadmap prepared: "${fallback.plan.title}".`,
          });
        }
      } catch (error) {
        console.error("AI command error:", error);
        addAssistantMessage({
          role: "ai",
          text: "Sorry, I encountered an error. Please try again.",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      addAssistantMessage,
      addGoal,
      addTask,
      batchAddTasks,
      deleteTask,
      handlePastedListCommand,
      handleYouTubePlaylistCommand,
      rescheduleOverdueTasks,
      taskCommandContext,
      updateTask,
    ]
  );

  const handleQuickAction = useCallback(
    async (action: string) => {
      await handleAiCommand(QUICK_ACTION_PROMPTS[action] || "Plan my day");
    },
    [handleAiCommand]
  );

  const handleConfirmPlan = useCallback(() => {
    if (!generatedPlan) return;

    const newTasks =
      pendingTasks.length > 0
        ? pendingTasks
        : buildTaskDrafts(generatedPlan, {
            startDate: todayStr,
            timeWindow: lifeContext.preferredStudyHours,
          });

    batchAddTasks(newTasks);
    addAssistantMessage({
      role: "ai",
      text: `Generated ${newTasks.length} task${newTasks.length === 1 ? "" : "s"} for "${generatedPlan.title}".`,
    });

    setShowPlanConfirmation(false);
    setGeneratedPlan(null);
    setPendingTasks([]);
  }, [
    addAssistantMessage,
    batchAddTasks,
    generatedPlan,
    lifeContext.preferredStudyHours,
    pendingTasks,
    todayStr,
  ]);

  useEffect(() => {
    let cancelled = false;

    const signature = JSON.stringify({
      completed: stats.completed,
      overdue: stats.overdue,
      completionRate: stats.completionRate,
      streak: stats.streak,
      focusToday,
      pending: stats.pending,
      topTasks: tasks.slice(0, 5).map((t) => ({
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate,
        completed: t.completed,
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
        if (!cancelled) setIsCoachLoading(false);
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

  const insight = useMemo(() => {
    if (coachData?.suggestion) return coachData.suggestion;
    if (stats.overdue > 3)
      return "You have multiple overdue tasks. Focus on the oldest first to regain momentum.";
    if (stats.completionRate >= 80)
      return "You're crushing it! Keep the momentum by tackling high-energy tasks in the morning.";
    if (stats.streak >= 5) return `${stats.streak}-day streak! Consistency is your superpower.`;
    return "Start with a quick win to build momentum.";
  }, [coachData, stats]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (
          searchQuery &&
          !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !task.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
          return false;
        }

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
      }),
    [tasks, searchQuery, filter, todayStr]
  );

  const { overdue, rest } = useMemo(() => {
    const overdueTasks = filteredTasks.filter((t) => isTaskOverdue(t, now));
    const restTasks = filteredTasks.filter((t) => !overdueTasks.includes(t));
    return { overdue: overdueTasks, rest: restTasks };
  }, [filteredTasks, now]);

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

      if (!cols[key]) cols[key] = [];
      cols[key].push(task);
    });

    return cols;
  }, [groupBy, rest]);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-5 flex items-center gap-6">
            <div className="relative">
              <ProgressRing
                progress={stats.todayTotal ? (stats.completedToday / stats.todayTotal) * 100 : 0}
                size={80}
              />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {stats.todayTotal ? Math.round((stats.completedToday / stats.todayTotal) * 100) : 0}%
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">This Week</h3>
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
            <div className="mt-3 flex gap-2 text-[10px] flex-wrap">
              <span className="glass px-2 py-1 rounded-full">
                ⏰ Best time: {coachData?.mostProductiveHour ?? "Morning"}
              </span>
              <span className="glass px-2 py-1 rounded-full">
                ⚡ {coachData?.weakArea ?? "High energy tasks first"}
              </span>
            </div>
          </GlassCard>
        </div>

        <AiCommandPanel onSubmit={handleAiCommand} isLoading={isProcessing} />
        <AiQuickActions onAction={handleQuickAction} isLoading={isProcessing} />
        <AiCoachCard
          completionRate={stats.completionRate}
          mostProductiveHour={coachData?.mostProductiveHour}
          weakArea={coachData?.weakArea}
          suggestion={coachData?.suggestion}
          tasksCompletedThisWeek={stats.completed}
          streakCount={stats.streak}
        />

        {(overdueGroups.length > 0 || rescheduleSummary) && (
          <div className="space-y-3">
            <AnimatePresence>
              {rescheduleSummary && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-2xl border border-neon-cyan/20 bg-white/5 p-4 text-sm text-white whitespace-pre-line"
                >
                  {rescheduleSummary}
                </motion.div>
              )}
            </AnimatePresence>

            {overdueGroups.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-neon-pink/20">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <h3 className="font-semibold text-sm text-neon-pink">
                      Overdue ({overdue.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Grouped by course tag or category. Each group keeps original order and respects your daily capacity.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReschedulePrompt(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 text-xs font-medium text-neon-pink"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Smart reschedule
                  </button>
                </div>

                <div className="space-y-3">
                  {overdueGroups.map((group) => (
                    <div
                      key={group.key}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="font-semibold text-sm text-white">
                            {titleCase(group.key)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"} · {formatMinutesHuman(group.totalMinutes)} total
                          </div>
                        </div>
                        <div className="text-[11px] text-neon-cyan">
                          {Math.ceil(group.totalMinutes / rescheduleDailyCapacity)} day plan
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggle={() => toggleTask(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            onEdit={() => setEditingTaskId(task.id)}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

          <div className="flex gap-1 flex-wrap">
            {(["all", "today", "pending", "done", "high"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize ${
                  filter === f
                    ? "bg-gradient-primary text-white glow-soft"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
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

        <AnimatePresence>
          {showQuickAdd && (
            <GlassCard className="p-4">
              <QuickAddForm onClose={() => setShowQuickAdd(false)} />
            </GlassCard>
          )}
        </AnimatePresence>

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
                      onEdit={() => setEditingTaskId(task.id)}
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
          <div className="space-y-4">
            {(overdueGroups.length > 0 || rescheduleSummary) && (
            <div className="space-y-3">
              <AnimatePresence>
                {rescheduleSummary && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-2xl border border-neon-cyan/20 bg-white/5 p-4 text-sm text-white whitespace-pre-line"
                  >
                    {rescheduleSummary}
                  </motion.div>
                )}
              </AnimatePresence>

              {overdueGroups.length > 0 && (
                <div className="glass rounded-2xl p-4 border border-neon-pink/20">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-neon-pink">
                        Overdue ({overdue.length})
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Grouped by course tag or category. Each group keeps original order and respects your daily capacity.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReschedulePrompt(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 text-xs font-medium text-neon-pink"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Smart reschedule
                    </button>
                  </div>

                  <div className="space-y-3">
                    {overdueGroups.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="font-semibold text-sm text-white">
                              {titleCase(group.key)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"} · {formatMinutesHuman(group.totalMinutes)} total
                            </div>
                          </div>
                          <div className="text-[11px] text-neon-cyan">
                            {Math.ceil(group.totalMinutes / rescheduleDailyCapacity)} day plan
                          </div>
                        </div>

                        <div className="space-y-2">
                          {group.tasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onToggle={() => toggleTask(task.id)}
                              onDelete={() => deleteTask(task.id)}
                              onEdit={() => setEditingTaskId(task.id)}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-4">

              {Object.entries(boardCols).map(([col, colTasks]) => (
                <div
                  key={col}
                  className="glass rounded-xl p-4 flex-1 min-w-[250px] max-w-[400px]"
                >
                  <h3 className="font-semibold text-sm mb-3">
                    {col} ({colTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(task.id)}
                        onDelete={() => deleteTask(task.id)}
                        onEdit={() => setEditingTaskId(task.id)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <TaskEditorDialog
          task={editingTask}
          open={Boolean(editingTask)}
          onOpenChange={(open) => {
            if (!open) setEditingTaskId(null);
          }}
          onSave={(patch) => {
            if (editingTask) updateTask(editingTask.id, patch);
          }}
          onDelete={() => {
            if (editingTask) {
              deleteTask(editingTask.id);
              setEditingTaskId(null);
            }
          }}
        />

        <PlanConfirmation
          plan={generatedPlan}
          isOpen={showPlanConfirmation}
          isLoading={isProcessing}
          onConfirm={handleConfirmPlan}
          onCancel={() => setShowPlanConfirmation(false)}
        />

        <Dialog open={showReschedulePrompt} onOpenChange={setShowReschedulePrompt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-neon-pink flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Reschedule Strategy
              </DialogTitle>
              <DialogDescription>
                How would you like to handle the overdue workload?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <button
                type="button"
                className="w-full text-left p-4 rounded-xl border border-white/10 hover:border-neon-cyan/50 hover:bg-white/5 transition group"
                onClick={() => {
                  setShowReschedulePrompt(false);
                  const result = rescheduleOverdueTasks("extend_deadline");
                  addAssistantMessage({ role: "ai", text: result.summary });
                }}
              >
                <div className="font-semibold text-white group-hover:text-neon-cyan transition">Extend Deadline</div>
                <div className="text-xs text-muted-foreground mt-1">Keep the daily workload exactly the same, but extend the course into additional days.</div>
              </button>

              <button
                type="button"
                className="w-full text-left p-4 rounded-xl border border-white/10 hover:border-neon-pink/50 hover:bg-white/5 transition group"
                onClick={() => {
                  setShowReschedulePrompt(false);
                  const result = rescheduleOverdueTasks("increase_load");
                  addAssistantMessage({ role: "ai", text: result.summary });
                }}
              >
                <div className="font-semibold text-white group-hover:text-neon-pink transition">Increase Daily Load</div>
                <div className="text-xs text-muted-foreground mt-1">Finish by the original deadline by temporarily increasing the number of hours you study per day.</div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}