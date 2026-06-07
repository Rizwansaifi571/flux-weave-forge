import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addLocalDays, formatLocalDate } from "@/lib/date";

export type Priority = "low" | "medium" | "high";
export type LifeCategory = "career" | "college" | "fitness" | "finance" | "personal";
export type GoalStatus = "active" | "paused" | "completed";

// New habit types
export type HabitCategory = "health" | "learning" | "career" | "fitness" | "spiritual" | "personal";
export type HabitDifficulty = "easy" | "medium" | "hard";

export interface HabitGoal {
  target: number;      // e.g., 4 liters, 30 pages, 1 hour
  current: number;     // progress so far today / overall
  unit: string;        // "liters", "pages", "hours", "questions", "sessions"
  targetDays?: number;   // e.g., 30 days challenge
  dueDate?: string;      // optional deadline
  lastCompletedDate?: string;   // to compute streak without scanning all history
  healthScore?: number;          // can be computed on the fly
}

export interface GoalPhase {
  id: string;
  title: string;
  tasks: string[];
  order: number;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  deadline?: string;
  phases: GoalPhase[];
  progress: number;
  category: LifeCategory;
  status: GoalStatus;
  createdAt: string;
}

export interface TimetableEntry {
  id: string;
  day: string;
  start: string;
  end: string;
  label: string;
}

export interface Exam {
  id: string;
  title: string;
  date: string;
  course?: string;
  notes?: string;
}

export interface Internship {
  id: string;
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "paused" | "completed";
}

export interface LifeContext {
  collegeTimetable: TimetableEntry[];
  exams: Exam[];
  internships: Internship[];
  sleepSchedule: { bedtime: string; wakeup: string };
  preferredStudyHours: { start: string; end: string };
  placementGoals: string[];
}

export interface DailyBriefing {
  date: string;
  morningBriefing: string;
  eveningSummary: string;
  tasksCompleted: number;
  tasksMissed: number;
  focusTime: number;
  riskAlerts: string[];
}

export interface BehaviorPattern {
  id: string;
  label: string;
  strength: number;
  notes?: string;
}

export interface UserBehavior {
  productiveHours: Record<string, number>;
  taskCompletionByType: Record<string, number>;
  averageFocusDuration: number;
  bestDays: string[];
  patterns: BehaviorPattern[];
}

export interface PlaylistImportItem {
  index: number;
  title: string;
  durationMinutes: number | null;
}

export interface PlaylistImport {
  id: string;
  title: string;
  items: PlaylistImportItem[];
  importedAt: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  tags: string[];
  focusMinutes: number;
  category: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  history: Record<string, boolean>;
  createdAt: string;
  // New fields (all optional for backward compatibility)
  category?: HabitCategory;
  difficulty?: HabitDifficulty;
  goal?: HabitGoal;
  notes?: Record<string, string>;      // date -> reflection text
  linkedGoalId?: string;               // ID of a goal from goals array
  milestone?: {
    streakMilestonesReached: number[]; // e.g., [7,30,100]
    totalCompletions: number;
  };
}

export interface WallpaperConfig {
  theme: "cyberpunk" | "minimal" | "neon" | "glass" | "anime" | "workspace";
  opacity: number;
  showTasks: boolean;
  maxTasksCount: number;
  showTaskCategory?: boolean;
  showTaskTime?: boolean;
  showTaskDate?: boolean;
  showTaskPriority?: boolean;
  showStreak: boolean;
  showQuote: boolean;
  showStats: boolean;
  showClock?: boolean;
  showDate?: boolean;
  showDailyHabits?: boolean;
  accent: "purple" | "blue" | "cyan" | "pink";
  font: "geist" | "mono" | "serif";
}

interface State {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  lifeContext: LifeContext;
  dailyBriefings: DailyBriefing[];
  behavior: UserBehavior;
  assistantMessages: AssistantMessage[];
  playlistImports: PlaylistImport[];
  xp: number;
  level: number;
  focusSessions: { date: string; minutes: number }[];
  streakCount: number;
  lastActiveDate?: string;
  wallpaper: WallpaperConfig;
  userName: string;

  addTask: (t: Omit<Task, "id" | "createdAt" | "completed">) => void;
  batchAddTasks: (tasks: Omit<Task, "id" | "createdAt" | "completed">[]) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  addHabit: (h: Omit<Habit, "id" | "createdAt" | "history">) => void;
  toggleHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  updateHabitProgress: (id: string, current: number) => void;
  addHabitNote: (id: string, date: string, note: string) => void;

  addGoal: (g: Omit<Goal, "id" | "createdAt" | "phases" | "progress" | "status"> & {
    phases?: GoalPhase[];
    progress?: number;
    status?: GoalStatus;
  }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addGoalPhase: (goalId: string, phase: Omit<GoalPhase, "id" | "completed"> & { completed?: boolean }) => void;

  setLifeContext: (context: LifeContext) => void;
  updateLifeContext: (patch: Partial<LifeContext>) => void;

  saveBriefing: (briefing: DailyBriefing) => void;
  getBriefing: (date: string) => DailyBriefing | undefined;

  recordBehavior: (patch: Partial<UserBehavior>) => void;

  addAssistantMessage: (message: Omit<AssistantMessage, "id" | "createdAt">) => void;
  clearAssistantMessages: () => void;

  addPlaylistImport: (playlist: Omit<PlaylistImport, "id" | "importedAt">) => void;
  clearPlaylistImports: () => void;

  logFocus: (minutes: number) => void;
  setWallpaper: (patch: Partial<WallpaperConfig>) => void;
  setUserName: (name: string) => void;
  resetStore: () => void;
}

const today = () => formatLocalDate(new Date());
const uid = () => Math.random().toString(36).slice(2, 10);

// Deterministic initial focus sessions (last 7 days with 0 minutes – no random)
const getInitialFocusSessions = () => {
  const sessions = [];
  for (let i = 6; i >= 0; i--) {
    sessions.push({ date: addLocalDays(today(), -i), minutes: 0 });
  }
  return sessions;
};

// Calculate streak count dynamically based on tasks, habits, and focus sessions
const calculateStreak = (
  tasks: Task[],
  habits: Habit[],
  focusSessions: { date: string; minutes: number }[]
): number => {
  const activeDates = new Set<string>();

  // 1. Task completions
  tasks.forEach((t) => {
    if (t.completed) {
      if (t.completedAt) {
        activeDates.add(t.completedAt.slice(0, 10));
      } else if (t.dueDate) {
        activeDates.add(t.dueDate);
      }
    }
  });

  // 2. Habit completions
  habits.forEach((h) => {
    Object.entries(h.history).forEach(([date, done]) => {
      if (done) activeDates.add(date);
    });
  });

  // 3. Focus sessions
  focusSessions.forEach((f) => {
    if (f.minutes > 0) activeDates.add(f.date);
  });

  if (activeDates.size === 0) return 0;

  const todayStr = formatLocalDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  // If neither today nor yesterday is active, streak is broken
  if (!activeDates.has(todayStr) && !activeDates.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  // Start checking backward from today (or yesterday if today doesn't have activity yet)
  let scanDate = activeDates.has(todayStr) ? current : yesterday;

  for (let i = 0; i < 365; i++) {
    const dateStr = formatLocalDate(scanDate);
    if (activeDates.has(dateStr)) {
      streak++;
      scanDate.setDate(scanDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

const getInitialState = () => ({
  tasks: [
    { id: uid(), title: "Ship WallTask AI v1", description: "Polish dashboard + wallpaper engine", priority: "high" as const, tags: ["product"], focusMinutes: 90, category: "Work", completed: false, createdAt: new Date().toISOString(), dueDate: today() },
    { id: uid(), title: "Deep work: 2h focus block", priority: "high" as const, tags: ["focus"], focusMinutes: 120, category: "Focus", completed: false, createdAt: new Date().toISOString(), dueDate: today() },
    { id: uid(), title: "Review weekly goals", priority: "medium" as const, tags: ["planning"], focusMinutes: 20, category: "Planning", completed: true, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), dueDate: today() },
    { id: uid(), title: "Read 30 pages", priority: "low" as const, tags: ["habit"], focusMinutes: 30, category: "Learning", completed: false, createdAt: new Date().toISOString() },
  ],
  habits: [
    { id: uid(), name: "Morning workout", emoji: "💪", color: "neon-purple", history: {}, createdAt: new Date().toISOString(), category: "fitness", difficulty: "medium" as const },
    { id: uid(), name: "Read 30 min", emoji: "📚", color: "neon-blue", history: {}, createdAt: new Date().toISOString(), category: "learning", difficulty: "easy" as const, goal: { target: 30, current: 0, unit: "pages" } },
    { id: uid(), name: "Meditate", emoji: "🧘", color: "neon-cyan", history: {}, createdAt: new Date().toISOString(), category: "spiritual", difficulty: "easy" as const },
    { id: uid(), name: "No social media", emoji: "🚫", color: "neon-pink", history: {}, createdAt: new Date().toISOString(), category: "personal", difficulty: "hard" as const },
  ],
  goals: [],
  lifeContext: {
    collegeTimetable: [],
    exams: [],
    internships: [],
    sleepSchedule: { bedtime: "23:30", wakeup: "07:30" },
    preferredStudyHours: { start: "20:00", end: "00:00" },
    placementGoals: [],
  },
  dailyBriefings: [],
  behavior: {
    productiveHours: {},
    taskCompletionByType: {},
    averageFocusDuration: 0,
    bestDays: [],
    patterns: [],
  },
  assistantMessages: [
    {
      id: uid(),
      role: "ai" as const,
      text: "I'm your productivity copilot. I see your tasks, habits, and focus patterns. Ask me anything — or let me suggest your next move.",
      createdAt: new Date().toISOString(),
    },
  ],
  playlistImports: [],
  xp: 25, // Starts with 25 XP since 1 mock task is completed
  level: 1, // Math.floor(25 / 500) + 1 = 1
  focusSessions: getInitialFocusSessions(),
  streakCount: 1, // 1 since 1 mock task is completed today
  wallpaper: {
    theme: "neon" as const,
    opacity: 0.85,
    showTasks: true,
    maxTasksCount: 3,
    showTaskCategory: false,
    showTaskTime: true,
    showTaskDate: false,
    showTaskPriority: true,
    showStreak: true,
    showQuote: true,
    showStats: true,
    showClock: true,
    showDate: true,
    showDailyHabits: true,
    accent: "purple" as const,
    font: "geist" as const,
  },
  userName: "Operator",
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      resetStore: () => set(() => getInitialState()),

      // Task actions
      addTask: (t) => set((s) => {
        const tasks = [{ ...t, id: uid(), completed: false, createdAt: new Date().toISOString() }, ...s.tasks];
        const streakCount = calculateStreak(tasks, s.habits, s.focusSessions);
        return { tasks, streakCount };
      }),
      batchAddTasks: (tasks) => set((s) => {
        const newTasks = [
          ...tasks.map((t) => ({ ...t, id: uid(), completed: false, createdAt: new Date().toISOString() })),
          ...s.tasks,
        ];
        const streakCount = calculateStreak(newTasks, s.habits, s.focusSessions);
        return { tasks: newTasks, streakCount };
      }),
      toggleTask: (id) => set((s) => {
        const tasks = s.tasks.map((t) => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t);
        const becameDone = tasks.find((t) => t.id === id)?.completed;
        const newXp = Math.max(0, s.xp + (becameDone ? 25 : -25));
        const newLevel = Math.floor(newXp / 500) + 1;
        const streakCount = calculateStreak(tasks, s.habits, s.focusSessions);
        return { tasks, xp: newXp, level: newLevel, streakCount };
      }),
      deleteTask: (id) => set((s) => {
        const tasks = s.tasks.filter((t) => t.id !== id);
        const streakCount = calculateStreak(tasks, s.habits, s.focusSessions);
        return { tasks, streakCount };
      }),
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })),

      // Habit actions (extended)
      addHabit: (h) => set((s) => {
        const habits = [...s.habits, { ...h, id: uid(), history: {}, createdAt: new Date().toISOString() }];
        const streakCount = calculateStreak(s.tasks, habits, s.focusSessions);
        return { habits, streakCount };
      }),
      toggleHabit: (id, date) => set((s) => {
        const habits = s.habits.map((h) => h.id === id ? { ...h, history: { ...h.history, [date]: !h.history[date] } } : h);
        const becameDone = habits.find((h) => h.id === id)?.history[date];
        const newXp = Math.max(0, s.xp + (becameDone ? 10 : -10));
        const newLevel = Math.floor(newXp / 500) + 1;
        const streakCount = calculateStreak(s.tasks, habits, s.focusSessions);
        return { habits, xp: newXp, level: newLevel, streakCount };
      }),
      deleteHabit: (id) => set((s) => {
        const habits = s.habits.filter((h) => h.id !== id);
        const streakCount = calculateStreak(s.tasks, habits, s.focusSessions);
        return { habits, streakCount };
      }),
      updateHabit: (id, patch) => set((s) => ({ habits: s.habits.map((h) => h.id === id ? { ...h, ...patch } : h) })),
      updateHabitProgress: (id, current) => set((s) => ({
        habits: s.habits.map((h) => h.id === id && h.goal ? { ...h, goal: { ...h.goal, current } } : h)
      })),
      addHabitNote: (id, date, note) => set((s) => ({
        habits: s.habits.map((h) => h.id === id ? { ...h, notes: { ...h.notes, [date]: note } } : h)
      })),

      // Goal actions
      addGoal: (g) => set((s) => ({
        goals: [
          {
            id: uid(),
            title: g.title,
            description: g.description ?? "",
            deadline: g.deadline,
            phases: g.phases ?? [],
            progress: g.progress ?? 0,
            category: g.category,
            status: g.status ?? "active",
            createdAt: new Date().toISOString(),
          },
          ...s.goals,
        ],
      })),
      updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      addGoalPhase: (goalId, phase) => set((s) => ({
        goals: s.goals.map((g) => {
          if (g.id !== goalId) return g;
          const order = phase.order ?? g.phases.length + 1;
          return {
            ...g,
            phases: [
              ...g.phases,
              {
                id: uid(),
                title: phase.title,
                tasks: phase.tasks ?? [],
                order,
                completed: phase.completed ?? false,
              },
            ],
          };
        }),
      })),

      // Life context
      setLifeContext: (context) => set({ lifeContext: context }),
      updateLifeContext: (patch) => set((s) => ({ lifeContext: { ...s.lifeContext, ...patch } })),

      // Briefings
      saveBriefing: (briefing) => set((s) => {
        const existing = s.dailyBriefings.filter((b) => b.date !== briefing.date);
        return { dailyBriefings: [briefing, ...existing] };
      }),
      getBriefing: (date) => get().dailyBriefings.find((b) => b.date === date),

      // Behavior
      recordBehavior: (patch) => set((s) => ({ behavior: { ...s.behavior, ...patch } })),

      // Assistant
      addAssistantMessage: (message) => set((s) => ({
        assistantMessages: [
          ...s.assistantMessages,
          { ...message, id: uid(), createdAt: new Date().toISOString() },
        ],
      })),
      clearAssistantMessages: () => set({ assistantMessages: [] }),

      // Playlist
      addPlaylistImport: (playlist) => set((s) => ({
        playlistImports: [
          {
            id: uid(),
            title: playlist.title,
            items: playlist.items,
            importedAt: new Date().toISOString(),
          },
          ...s.playlistImports,
        ],
      })),
      clearPlaylistImports: () => set({ playlistImports: [] }),

      // Focus, XP, etc.
      logFocus: (minutes) => set((s) => {
        const d = today();
        const existing = s.focusSessions.find((f) => f.date === d);
        const sessions = existing
          ? s.focusSessions.map((f) => f.date === d ? { ...f, minutes: f.minutes + minutes } : f)
          : [...s.focusSessions, { date: d, minutes }];
        const newXp = s.xp + minutes * 2;
        const newLevel = Math.floor(newXp / 500) + 1;
        const streakCount = calculateStreak(s.tasks, s.habits, sessions);
        return { focusSessions: sessions, xp: newXp, level: newLevel, streakCount };
      }),
      setWallpaper: (patch) => set((s) => ({ wallpaper: { ...s.wallpaper, ...patch } })),
      setUserName: (name) => set({ userName: name }),
    }),
    {
      name: "walltask-ai-store",
      skipHydration: true,
    }
  )
);

export const todayStr = today;

export const motivationalQuotes = [
  "Discipline is the bridge between goals and accomplishment.",
  "Small steps every day. That's the whole game.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "Focus is a muscle. Train it daily.",
  "Done is better than perfect. Shipped is better than done.",
  "Win the morning, win the day.",
  "The cave you fear holds the treasure you seek.",
];

// --- Live Sync Integration ---
if (typeof window !== "undefined") {
  // Check if we are running in the Electron renderer
  const isElectron = (window as any).electronAPI !== undefined;

  if (!isElectron) {
    // We are in the browser (web app). Connect to local WS server.
    const connectSync = () => {
      try {
        const ws = new WebSocket("ws://localhost:34567");

        ws.onopen = () => {
          console.log("Connected to WallTask Companion sync server.");
          // Send current state initially
          ws.send(JSON.stringify({ type: "SYNC_STATE", state: useStore.getState() }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "SYNC_STATE" && data.state) {
              // Only apply if needed (avoid infinite loops)
              // We'll trust the desktop app's state if we just connected
              useStore.setState(data.state);
            }
          } catch (e) {
            console.error("Failed to parse sync message", e);
          }
        };

        ws.onclose = () => {
          console.log("Disconnected from WallTask Companion. Retrying in 5s...");
          setTimeout(connectSync, 5000);
        };

        ws.onerror = () => {
          // Silent error for connection refused
          ws.close();
        };

        // Subscribe to local store changes and broadcast them
        let isSyncing = false;
        useStore.subscribe((state) => {
          if (isSyncing) return;
          if (ws.readyState === WebSocket.OPEN) {
            isSyncing = true;
            ws.send(JSON.stringify({ type: "SYNC_STATE", state }));
            setTimeout(() => { isSyncing = false; }, 50); // Simple debounce/throttle
          }
        });
      } catch (e) {
        // Ignore WebSocket creation errors
      }
    };
    
    // Delay connection slightly to ensure store is hydrated
    setTimeout(connectSync, 1000);
  }
}