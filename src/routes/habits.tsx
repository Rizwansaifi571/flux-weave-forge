import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { useStore, type Habit, type HabitCategory, type HabitDifficulty } from "@/lib/store";
import { formatLocalDate, startOfLocalDay } from "@/lib/date";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import {
  Flame,
  TrendingUp,
  Award,
  Zap,
  Brain,
  Lightbulb,
  BarChart3,
  ListChecks,
  X,
  Edit2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Target,
  Clock,
  Save,
  Trash2,
  MessageCircle,
  Send,
  RotateCcw,
  Plus,
  CalendarDays,
  Sparkles,
  Check,
} from "lucide-react";
import { askAssistant } from "@/lib/api/assistant.functions";

export const Route = createFileRoute("/habits")({ component: HabitsPage });

// ---------- Constants ----------
const COLORS = ["neon-purple", "neon-blue", "neon-cyan", "neon-pink"];
const CATEGORIES: HabitCategory[] = ["health", "learning", "career", "fitness", "spiritual", "personal"];
const DIFFICULTIES: HabitDifficulty[] = ["easy", "medium", "hard"];

const TEMPLATES = [
  {
    name: "🚀 Placement Prep",
    habits: ["DSA Practice", "Aptitude Test", "CS Fundamentals"],
    category: "learning",
    difficulty: "hard",
    targetDays: 60,
  },
  {
    name: "🏋️ Fitness",
    habits: ["Morning Workout", "Drink 3L Water", "Sleep 8h"],
    category: "fitness",
    difficulty: "medium",
    targetDays: 30,
  },
  {
    name: "📚 Study Mode",
    habits: ["Revision", "Practice Problems", "Reading"],
    category: "learning",
    difficulty: "medium",
    targetDays: 45,
  },
];

type HabitDraft = {
  name: string;
  emoji: string;
  category: HabitCategory;
  difficulty: HabitDifficulty;
  targetDays?: number;
  description?: string;
  why?: string;
};

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  suggestedHabit?: HabitDraft;
};

type AssistantIntent = "create" | "update" | "delete" | "toggle" | "advice";

type AssistantHabitPayload = {
  intent: AssistantIntent;
  reply: string;
  confidence?: number;
  targetName?: string;
  habit?: Partial<HabitDraft>;
  patch?: Partial<HabitDraft>;
};

type AssistantBuilderPayload = {
  name?: string;
  emoji?: string;
  category?: HabitCategory;
  difficulty?: HabitDifficulty;
  targetDays?: number | null;
  description?: string;
  why?: string;
};

const BUILDER_JSON_RULES = `
Return JSON only.
Schema:
{
  "name": string,
  "emoji": string,
  "category": "health" | "learning" | "career" | "fitness" | "spiritual" | "personal",
  "difficulty": "easy" | "medium" | "hard",
  "targetDays": number | null,
  "description": string,
  "why": string
}

Rules:
- Use a short premium title for "name".
- Do NOT copy the user's full sentence as the habit name.
- Make it feel like a real habit title, not a command.
- Example names: "English Practice", "Morning Workout", "DSA Revision", "Reading Sprint".
- If the user says duration, use targetDays when it makes sense.
- If the user says "daily", reflect that in description, not in the title.
`;

const CHAT_JSON_RULES = `
You are an AI habit operating system.

Return JSON only.
Schema:
{
  "intent": "create" | "update" | "delete" | "toggle" | "advice",
  "reply": string,
  "confidence": number,
  "targetName": string | null,
  "habit": {
    "name": string,
    "emoji": string,
    "category": "health" | "learning" | "career" | "fitness" | "spiritual" | "personal",
    "difficulty": "easy" | "medium" | "hard",
    "targetDays": number | null,
    "description": string
  },
  "patch": {
    "name": string,
    "emoji": string,
    "category": "health" | "learning" | "career" | "fitness" | "spiritual" | "personal",
    "difficulty": "easy" | "medium" | "hard",
    "targetDays": number | null,
    "description": string
  }
}

Rules:
- If the user wants to add a new habit, intent = "create".
- If the user wants to edit a habit, intent = "update".
- If the user wants to remove a habit, intent = "delete".
- If the user wants to mark a habit done/undone, intent = "toggle".
- If the message is vague or too general like "all" or "those", intent = "advice" and reply with a short clarifying question.
- Keep reply short, natural, and helpful.
- For create/update, give the habit a clean premium name, not the user's exact sentence.
- For update/delete/toggle, targetName should be the habit to act on.
`;

function smartTitleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      if (word.length <= 3 && /^[a-z]+$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHabitNameFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/^(add|create|make|build)\s+(a\s+)?habit(\s+to)?\s*/i, "")
    .replace(/^(i want to|i'd like to|please|help me)\s*/i, "")
    .replace(/\b(daily|every day|each day|per day)\b/gi, "")
    .replace(/\b(for|within|in)\s+\d+\s*(min|mins|minutes|hour|hours|day|days|week|weeks|month|months)\b/gi, "")
    .replace(/\b\d+\s*(min|mins|minutes|hour|hours|day|days|week|weeks|month|months)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return smartTitleCase(cleaned || "New Habit");
}

function extractJsonBlock<T>(input: string): T | null {
  try {
    const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced?.[1] ?? input;
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;
    return JSON.parse(objMatch[0]) as T;
  } catch {
    return null;
  }
}

function normalizeCategory(value?: string): HabitCategory {
  const v = normalizeText(value || "");
  if (v.includes("health")) return "health";
  if (v.includes("learn")) return "learning";
  if (v.includes("career")) return "career";
  if (v.includes("fitness")) return "fitness";
  if (v.includes("spiritual")) return "spiritual";
  return "personal";
}

function normalizeDifficulty(value?: string): HabitDifficulty {
  const v = normalizeText(value || "");
  if (v.includes("hard")) return "hard";
  if (v.includes("easy")) return "easy";
  return "medium";
}

function sanitizeTargetDays(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(365, Math.floor(n));
}

function coerceHabitDraft(input: Partial<HabitDraft> | undefined, fallbackName: string): HabitDraft {
  return {
    name: smartTitleCase(input?.name?.trim() || extractHabitNameFromPrompt(fallbackName)),
    emoji: input?.emoji?.trim() || "✨",
    category: normalizeCategory(input?.category),
    difficulty: normalizeDifficulty(input?.difficulty),
    targetDays: sanitizeTargetDays(input?.targetDays),
    description: input?.description?.trim() || undefined,
    why: input?.why?.trim() || undefined,
  };
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
  const completed = days.filter((d) => history[d] === true).length;
  return days.length ? (completed / days.length) * 100 : 0;
}

async function askForJson<T>(message: string, context: Record<string, unknown> = {}): Promise<T | null> {
  const response = await askAssistant({
    data: { message, context },
  });

  return extractJsonBlock<T>(response.response);
}

function isSameHabit(a: string, b: string) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------- Components ----------
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
        transition={{ duration: 0.7, ease: "easeOut" }}
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

function EditHabitModal({
  habit,
  onClose,
  onSave,
}: {
  habit: Habit;
  onClose: () => void;
  onSave: (updated: Partial<Habit>) => void;
}) {
  const [name, setName] = useState(habit.name);
  const [emoji, setEmoji] = useState(habit.emoji);
  const [category, setCategory] = useState<HabitCategory>(habit.category || "personal");
  const [difficulty, setDifficulty] = useState<HabitDifficulty>(habit.difficulty || "medium");
  const [targetDays, setTargetDays] = useState(habit.targetDays || 0);
  const [dueDate, setDueDate] = useState(habit.dueDate || "");

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="glass p-6 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Edit Habit</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass w-full rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="glass w-full rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HabitCategory)}
              className="glass w-full rounded-lg p-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as HabitDifficulty)}
              className="glass w-full rounded-lg p-2 text-sm"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Target Days (0 = no target)</label>
            <input
              type="number"
              value={targetDays}
              onChange={(e) => setTargetDays(Number(e.target.value))}
              className="glass w-full rounded-lg p-2 text-sm"
              placeholder="e.g., 30 for a challenge"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Due Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="glass w-full rounded-lg p-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                name: smartTitleCase(name),
                emoji: emoji || "✨",
                category,
                difficulty,
                targetDays: targetDays || undefined,
                dueDate: dueDate || undefined,
              });
              onClose();
            }}
            className="bg-gradient-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1"
          >
            <Save className="h-4 w-4" /> Save
          </button>
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
  const [aiGeneratedHabit, setAiGeneratedHabit] = useState<HabitDraft | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [editingNote, setEditingNote] = useState<{ habitId: string; date: string; text: string } | null>(null);
  const [pendingChatHabit, setPendingChatHabit] = useState<HabitDraft | null>(null);

  const today = formatLocalDate(new Date());

  const currentStreak = useMemo(
    () => Math.max(...habits.map((h) => getStreak(h.history, today)), 0),
    [habits, today]
  );
  const totalHabits = habits.length;
  const completedToday = useMemo(() => habits.filter((h) => h.history[today]).length, [habits, today]);
  const completionRate = totalHabits ? Math.round((completedToday / totalHabits) * 100) : 0;
  const remainingHabits = useMemo(() => habits.filter((h) => !h.history[today]), [habits, today]);

  const weeklyDays = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return formatLocalDate(d);
    });
  }, []);

  const weeklyCompletionRate = useMemo(() => {
    if (!habits.length) return 0;
    const total = habits.reduce((acc, h) => acc + getCompletionRate(h.history, weeklyDays), 0);
    return Math.round(total / habits.length);
  }, [habits, weeklyDays]);

  const coachInsights = useMemo(() => {
    if (habits.length === 0) {
      return ["Add a habit to get personalized insights from your AI coach."];
    }

    const insights: string[] = [];
    const streaks = habits.map((h) => ({
      habit: h,
      streak: getStreak(h.history, today),
      completion: getCompletionRate(h.history, weeklyDays),
    }));
    const best = [...streaks].sort((a, b) => b.streak - a.streak)[0];
    const mostSkipped = [...streaks].sort((a, b) => a.completion - b.completion)[0];
    const totalCompletions = habits.reduce(
      (sum, h) => sum + Object.values(h.history).filter((v) => v === true).length,
      0
    );

    if (best) {
      insights.push(`🔥 Strongest habit: ${best.habit.name} with a ${best.streak}-day streak.`);
    }

    if (mostSkipped && mostSkipped.habit.id !== best?.habit.id) {
      insights.push(
        `⚠️ Highest risk habit: ${mostSkipped.habit.name}. Try moving it to your best time of day.`
      );
    }

    insights.push(`📊 You have completed ${totalCompletions} habit records. Every step counts.`);
    insights.push(`📈 Weekly consistency is ${weeklyCompletionRate}%.`);

    return insights;
  }, [habits, today, weeklyDays, weeklyCompletionRate]);

  const findHabitByName = useCallback(
    (query?: string | null) => {
      if (!query?.trim()) return null;
      const normalizedQuery = normalizeText(query);
      return (
        habits.find(
          (habit) =>
            normalizeText(habit.name) === normalizedQuery ||
            normalizeText(habit.name).includes(normalizedQuery) ||
            normalizedQuery.includes(normalizeText(habit.name))
        ) || null
      );
    },
    [habits]
  );

  const addHabitFromDraft = useCallback(
    (draft: HabitDraft) => {
      addHabit({
        name: smartTitleCase(draft.name),
        emoji: draft.emoji || "✨",
        color: COLORS[habits.length % COLORS.length],
        category: draft.category,
        difficulty: draft.difficulty,
        targetDays: draft.targetDays,
      });
    },
    [addHabit, habits.length]
  );

  const generateHabitFromAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);

    try {
      const parsed = await askForJson<AssistantBuilderPayload>(
        `
You are a premium habit designer.

The user wants to create a habit from this request:
"${aiPrompt}"

${BUILDER_JSON_RULES}
`,
        {}
      );

      const draft = coerceHabitDraft(
        {
          name: parsed?.name,
          emoji: parsed?.emoji,
          category: parsed?.category,
          difficulty: parsed?.difficulty,
          targetDays: parsed?.targetDays ?? undefined,
          description: parsed?.description,
          why: parsed?.why,
        },
        aiPrompt
      );

      setAiGeneratedHabit(draft);
    } catch {
      setAiGeneratedHabit(
        coerceHabitDraft(
          {
            name: extractHabitNameFromPrompt(aiPrompt),
            emoji: "✨",
            category: "personal",
            difficulty: "medium",
          },
          aiPrompt
        )
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const addAiGeneratedHabit = () => {
    if (!aiGeneratedHabit) return;
    addHabitFromDraft(aiGeneratedHabit);
    setAiGeneratedHabit(null);
    setAiPrompt("");
    setShowBuilder(false);
  };

  const addSuggestedHabitDirectly = useCallback(
    (suggested: HabitDraft) => {
      addHabitFromDraft(suggested);
      setPendingChatHabit(null);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Created "${suggested.name}" successfully. It is now in your habit list.`,
        },
      ]);
    },
    [addHabitFromDraft]
  );

  const applyHabitPatch = useCallback(
    (habit: Habit, patch: Partial<HabitDraft>) => {
      const updated: Partial<Habit> = {};

      if (patch.name?.trim()) updated.name = smartTitleCase(patch.name);
      if (patch.emoji?.trim()) updated.emoji = patch.emoji;
      if (patch.category) updated.category = patch.category;
      if (patch.difficulty) updated.difficulty = patch.difficulty;
      if (patch.targetDays !== undefined) updated.targetDays = sanitizeTargetDays(patch.targetDays);
      if (patch.description !== undefined) {
        (updated as Partial<Habit> & { description?: string }).description = patch.description;
      }

      updateHabit(habit.id, updated);
    },
    [updateHabit]
  );

  const handleChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");

    const lower = normalizeText(userMsg);

    const quickFollowUp = /^(add|create)\s+(those|that|this|them)\s+habit(s)?$/.test(lower) || /^(add|create)\s+(those|that|this|them)$/.test(lower);
    if (quickFollowUp && pendingChatHabit) {
      addSuggestedHabitDirectly(pendingChatHabit);
      return;
    }

    try {
      const contextHabits = habits.map((h) => ({
        name: h.name,
        streak: getStreak(h.history, today),
        category: h.category,
        difficulty: h.difficulty,
      }));

      const parsed = await askForJson<AssistantHabitPayload>(
        `
User message:
"${userMsg}"

Current habits:
${JSON.stringify(contextHabits)}

${CHAT_JSON_RULES}
`,
        { habits: contextHabits }
      );

      const intent = parsed?.intent || "advice";
      const reply = parsed?.reply?.trim() || "Got it.";
      const confidence = parsed?.confidence ?? 0;

      if (intent === "create") {
        const draft = coerceHabitDraft(parsed?.habit, userMsg);

        const shouldPreview =
          confidence < 0.7 ||
          /\b(suggest|recommend|maybe|idea|preview|show)\b/i.test(userMsg);

        if (shouldPreview) {
          setPendingChatHabit(draft);
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `${reply} Preview: "${draft.name}" (${draft.emoji}, ${draft.category}, ${draft.difficulty})`,
              suggestedHabit: draft,
            },
          ]);
        } else {
          addHabitFromDraft(draft);
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `${reply} I created "${draft.name}" for you.`,
            },
          ]);
        }
        return;
      }

      if (intent === "toggle") {
        const target = findHabitByName(parsed?.targetName || parsed?.habit?.name || userMsg);
        if (!target) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `I could not find the habit you mean. Please name it more specifically.`,
            },
          ]);
          return;
        }

        toggleHabit(target.id, today);
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: `Done. I toggled "${target.name}".` },
        ]);
        return;
      }

      if (intent === "update") {
        const target = findHabitByName(parsed?.targetName || parsed?.habit?.name || userMsg);
        if (!target) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `I could not find the habit to update. Tell me the habit name.`,
            },
          ]);
          return;
        }

        const patch = parsed?.patch || parsed?.habit || {};
        applyHabitPatch(target, patch);

        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: `Updated "${target.name}" successfully.` },
        ]);
        return;
      }

      if (intent === "delete") {
        const target = findHabitByName(parsed?.targetName || parsed?.habit?.name || userMsg);
        if (!target) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `I could not find the habit to delete. Tell me the exact habit name.`,
            },
          ]);
          return;
        }

        deleteHabit(target.id);
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: `Deleted "${target.name}".` },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            reply ||
            "Tell me a goal, a habit to create, or a habit to edit, and I will handle it.",
        },
      ]);
    } catch {
      const lowerForFallback = normalizeText(userMsg);

      if (
        lowerForFallback.includes("add habit") ||
        lowerForFallback.includes("create habit") ||
        lowerForFallback.includes("new habit") ||
        lowerForFallback.includes("make habit")
      ) {
        const name = extractHabitNameFromPrompt(userMsg);
        const fallbackHabit = coerceHabitDraft(
          {
            name,
            emoji: "✨",
            category: "personal",
            difficulty: "medium",
          },
          userMsg
        );

        setPendingChatHabit(fallbackHabit);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `I drafted "${fallbackHabit.name}". Click add if you want this habit created.`,
            suggestedHabit: fallbackHabit,
          },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I can help create, update, delete, or toggle habits. Try: 'add a habit to learn English daily for 30 min' or 'mark Morning Workout done'.",
        },
      ]);
    }
  };

  const addChatSuggestedHabit = (suggested: HabitDraft) => {
    addHabitFromDraft(suggested);
    setPendingChatHabit(null);
    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.suggestedHabit?.name === suggested.name ? { ...msg, text: `${msg.text} ✅ Added!` } : msg
      )
    );
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const addTemplate = (tmpl: (typeof TEMPLATES)[number]) => {
    tmpl.habits.forEach((name) => {
      addHabit({
        name,
        emoji: "✨",
        color: COLORS[habits.length % COLORS.length],
        category: tmpl.category as HabitCategory,
        difficulty: tmpl.difficulty as HabitDifficulty,
        targetDays: tmpl.targetDays,
      });
    });
  };

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="p-5 flex items-center gap-4">
            <Flame className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-3xl font-bold">{currentStreak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </GlassCard>
          <GlassCard className="p-5 flex items-center gap-4">
            <ListChecks className="h-8 w-8 text-neon-cyan" />
            <div>
              <p className="text-3xl font-bold">
                {completedToday}/{totalHabits}
              </p>
              <p className="text-xs text-muted-foreground">Done Today</p>
            </div>
          </GlassCard>
          <GlassCard className="p-5 flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-3xl font-bold">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
            </div>
          </GlassCard>
          <GlassCard className="p-5 flex items-center gap-4">
            <Award className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-3xl font-bold">{habits.length}</p>
              <p className="text-xs text-muted-foreground">Active Habits</p>
            </div>
          </GlassCard>
        </div>

        {/* Today's Mission */}
        <GlassCard className="p-6 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20 border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-400" /> Today's Mission
              </h2>
              <p className="text-sm mt-1">
                {remainingHabits.length} habit{remainingHabits.length !== 1 ? "s" : ""} remaining
              </p>
              {remainingHabits.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Stay consistent — every check brings you closer to your goals.
                </p>
              )}
            </div>
            <div className="relative">
              <ProgressRing progress={completionRate} size={80} strokeWidth={6} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                {completionRate}%
              </span>
            </div>
          </div>
        </GlassCard>

        {/* AI Coach Insights */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-neon-cyan" /> AI Coach
          </div>
          <ul className="space-y-2 text-sm">
            {coachInsights.map((insight, i) => (
              <li key={i} className="flex gap-2">
                <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-400" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowBuilder(true)}
            className="glass px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition"
          >
            <Plus className="h-4 w-4" /> AI Habit Builder
          </button>
          <button
            onClick={() => setAiChatOpen(true)}
            className="glass px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition"
          >
            <MessageCircle className="h-4 w-4" /> AI Assistant
          </button>
        </div>

        {/* Habit Cards */}
        <div className="space-y-3">
          {habits.map((habit) => {
            const streak = getStreak(habit.history, today);
            const isExpanded = expandedId === habit.id;
            const targetProgress = habit.targetDays ? (streak / habit.targetDays) * 100 : 0;
            const daysLeft = habit.targetDays ? Math.max(0, habit.targetDays - streak) : null;
            const noteForToday = habit.notes?.[today] || "";

            return (
              <GlassCard key={habit.id} className="!p-0 overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition flex justify-between items-center"
                  onClick={() => setExpandedId(isExpanded ? null : habit.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{habit.emoji}</span>
                    <div>
                      <div className="font-semibold text-lg">{habit.name}</div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-400" /> {streak} days
                        </span>
                        {habit.targetDays && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-neon-cyan" /> {daysLeft} days left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHabit(habit.id, today);
                      }}
                      className="rounded-full p-1"
                    >
                      {habit.history[today] ? (
                        <CheckCircle className="h-6 w-6 text-neon-cyan" />
                      ) : (
                        <Circle className="h-6 w-6 text-white/40" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingHabit(habit);
                      }}
                      className="p-1 text-muted-foreground hover:text-neon-cyan"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10 p-4 space-y-4"
                    >
                      {habit.targetDays && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Challenge Progress</span>
                            <span className="font-medium">
                              {streak} / {habit.targetDays} days
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
                              animate={{ width: `${Math.min(100, targetProgress)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          {daysLeft === 0 && (
                            <p className="text-xs text-neon-cyan">🎉 Challenge completed! Great job.</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="glass px-2 py-1 rounded-full">{habit.category}</span>
                        <span className="glass px-2 py-1 rounded-full">{habit.difficulty}</span>
                        <button onClick={() => setDrawerHabit(habit)} className="text-neon-cyan underline">
                          View Details
                        </button>
                        <button onClick={() => deleteHabit(habit.id)} className="text-red-400 underline">
                          Delete
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => setEditingNote({ habitId: habit.id, date: today, text: noteForToday })}
                          className="text-xs text-neon-cyan flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" /> Add reflection
                        </button>
                        {noteForToday && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            📝 {noteForToday}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}

          {habits.length === 0 && (
            <GlassCard className="p-12 text-center">
              <p className="text-muted-foreground">
                No habits yet. Use the AI Builder or Assistant to create your first habit.
              </p>
            </GlassCard>
          )}
        </div>

        {/* Weekly Summary */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-5 w-5 text-neon-cyan" /> Weekly Summary
          </div>
          <p className="text-sm">
            {habits.length === 0
              ? "Add habits to see your weekly progress."
              : `Your average weekly completion is ${weeklyCompletionRate}%. Keep building momentum.`}
          </p>
        </GlassCard>

        {/* Templates */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Quick Start Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEMPLATES.map((tmpl, i) => (
              <GlassCard
                key={i}
                className="p-3 cursor-pointer hover:scale-105 transition"
                onClick={() => addTemplate(tmpl)}
              >
                <p className="font-medium">{tmpl.name}</p>
                <p className="text-xs text-muted-foreground">{tmpl.habits.join(", ")}</p>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Quick Add */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const input = form.elements.namedItem("habitName") as HTMLInputElement | null;
            const name = input?.value?.trim();
            if (!name) return;
            addHabit({
              name: smartTitleCase(name),
              emoji: "➕",
              color: COLORS[habits.length % COLORS.length],
              category: "personal",
              difficulty: "medium",
            });
            form.reset();
          }}
          className="glass p-4 rounded-xl flex gap-2"
        >
          <input
            name="habitName"
            placeholder="Quick habit name..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button type="submit" className="bg-gradient-primary px-4 py-2 rounded-lg text-xs">
            + Add
          </button>
        </form>

        {/* Modals */}
        {editingHabit && (
          <EditHabitModal
            habit={editingHabit}
            onClose={() => setEditingHabit(null)}
            onSave={(updated) => updateHabit(editingHabit.id, updated)}
          />
        )}

        {/* Habit Details Drawer */}
        <AnimatePresence>
          {drawerHabit && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
              onClick={() => setDrawerHabit(null)}
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="w-full max-w-md glass h-full overflow-y-auto p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">
                    {drawerHabit.emoji} {drawerHabit.name}
                  </h2>
                  <button onClick={() => setDrawerHabit(null)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-muted-foreground">🔥 Current Streak:</span>{" "}
                    {getStreak(drawerHabit.history, today)} days
                  </div>
                  {drawerHabit.targetDays && (
                    <div>
                      <span className="text-muted-foreground">🎯 Target:</span>{" "}
                      {drawerHabit.targetDays} days
                    </div>
                  )}
                  <div className="border-t pt-2">
                    <h4 className="font-semibold">Notes</h4>
                    {drawerHabit.notes &&
                      Object.entries(drawerHabit.notes)
                        .slice(-5)
                        .map(([date, note]) => (
                          <p key={date} className="text-xs mt-1">
                            <strong>{date}:</strong> {note}
                          </p>
                        ))}
                    {(!drawerHabit.notes || Object.keys(drawerHabit.notes).length === 0) && (
                      <p className="text-xs">No notes yet.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Habit Builder Modal */}
        <AnimatePresence>
          {showBuilder && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                setShowBuilder(false);
                setAiGeneratedHabit(null);
              }}
            >
              <div className="glass p-6 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">AI Habit Builder</h3>
                  <button
                    onClick={() => {
                      setShowBuilder(false);
                      setAiGeneratedHabit(null);
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="glass w-full rounded-lg p-3 text-sm"
                  placeholder="Describe what you want to achieve.&#10;e.g. 'I want to improve my English speaking every day for 30 days'"
                />

                <button
                  onClick={generateHabitFromAI}
                  disabled={aiGenerating}
                  className="mt-3 w-full bg-gradient-primary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  {aiGenerating ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    "Generate Habit"
                  )}
                </button>

                {aiGeneratedHabit && (
                  <div className="mt-4 p-4 glass rounded-lg space-y-3 border border-white/10">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl grid place-items-center bg-gradient-to-br from-neon-cyan to-neon-purple text-xl">
                        {aiGeneratedHabit.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-base">{aiGeneratedHabit.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {aiGeneratedHabit.category} • {aiGeneratedHabit.difficulty}
                        </p>
                      </div>
                    </div>

                    {aiGeneratedHabit.description && (
                      <p className="text-sm text-muted-foreground">{aiGeneratedHabit.description}</p>
                    )}

                    {aiGeneratedHabit.targetDays && (
                      <p className="text-xs text-neon-cyan">
                        Target: {aiGeneratedHabit.targetDays} days
                      </p>
                    )}

                    {aiGeneratedHabit.why && (
                      <div className="text-xs text-muted-foreground border-t border-white/10 pt-2">
                        <span className="text-foreground font-medium">Why this habit:</span>{" "}
                        {aiGeneratedHabit.why}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setAiGeneratedHabit(null)}
                        className="flex-1 text-sm bg-white/10 py-2 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addAiGeneratedHabit}
                        className="flex-1 bg-neon-cyan/20 text-sm py-2 rounded"
                      >
                        Add Habit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Chat Modal */}
        <AnimatePresence>
          {aiChatOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setAiChatOpen(false)}
            >
              <div
                className="glass rounded-xl w-full max-w-md h-[520px] flex flex-col border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-neon-cyan" />
                    AI Habit Coach
                  </h3>
                  <button onClick={() => setAiChatOpen(false)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user" ? "bg-neon-cyan/20 text-white" : "bg-white/10"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {chatMessages.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm space-y-2">
                      <p>Say something like “add a habit to learn English” or “mark workout done”.</p>
                      <p className="text-xs">
                        You can also say: update, delete, toggle, or ask for advice.
                      </p>
                    </div>
                  )}
                </div>

                {chatMessages.some((m) => m.suggestedHabit) && (
                  <div className="p-3 border-t border-white/10">
                    <button
                      onClick={() => {
                        const last = [...chatMessages].reverse().find((m) => m.suggestedHabit);
                        if (last?.suggestedHabit) addChatSuggestedHabit(last.suggestedHabit);
                      }}
                      className="w-full bg-neon-cyan/20 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" /> Add Suggested Habit
                    </button>
                  </div>
                )}

                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatMessage()}
                    className="flex-1 glass rounded-lg px-3 py-2 text-sm outline-none"
                    placeholder="e.g. add a habit to learn English"
                  />
                  <button onClick={handleChatMessage} className="bg-gradient-primary px-3 py-2 rounded-lg">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Notes Modal */}
        <AnimatePresence>
          {editingNote && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setEditingNote(null)}
            >
              <div className="glass p-5 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold mb-2">Reflection for {editingNote.date}</h3>
                <textarea
                  value={editingNote.text}
                  onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                  rows={3}
                  className="glass w-full rounded-lg p-2 text-sm"
                  placeholder="How did it go? Any challenges?"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditingNote(null)}>Cancel</button>
                  <button
                    onClick={() => {
                      addHabitNote(editingNote.habitId, editingNote.date, editingNote.text);
                      setEditingNote(null);
                    }}
                    className="bg-neon-cyan/20 px-3 py-1 rounded-lg"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}