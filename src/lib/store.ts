import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Priority = "low" | "medium" | "high";
export type LifeCategory = "career" | "college" | "fitness" | "finance" | "personal";
export type GoalStatus = "active" | "paused" | "completed";

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
}

export interface WallpaperConfig {
  theme: "cyberpunk" | "minimal" | "neon" | "glass" | "anime" | "workspace";
  opacity: number;
  showTasks: boolean;
  showStreak: boolean;
  showQuote: boolean;
  showStats: boolean;
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
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  addHabit: (h: Omit<Habit, "id" | "createdAt" | "history">) => void;
  toggleHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;

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
}

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

// Deterministic initial focus sessions (last 7 days with 0 minutes – no random)
const getInitialFocusSessions = () => {
  const sessions = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sessions.push({ date: d.toISOString().slice(0, 10), minutes: 0 });
  }
  return sessions;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      tasks: [
        { id: uid(), title: "Ship WallTask AI v1", description: "Polish dashboard + wallpaper engine", priority: "high", tags: ["product"], focusMinutes: 90, category: "Work", completed: false, createdAt: new Date().toISOString(), dueDate: today() },
        { id: uid(), title: "Deep work: 2h focus block", priority: "high", tags: ["focus"], focusMinutes: 120, category: "Focus", completed: false, createdAt: new Date().toISOString(), dueDate: today() },
        { id: uid(), title: "Review weekly goals", priority: "medium", tags: ["planning"], focusMinutes: 20, category: "Planning", completed: true, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), dueDate: today() },
        { id: uid(), title: "Read 30 pages", priority: "low", tags: ["habit"], focusMinutes: 30, category: "Learning", completed: false, createdAt: new Date().toISOString() },
      ],
      habits: [
        { id: uid(), name: "Morning workout", emoji: "💪", color: "neon-purple", history: {}, createdAt: new Date().toISOString() },
        { id: uid(), name: "Read 30 min", emoji: "📚", color: "neon-blue", history: {}, createdAt: new Date().toISOString() },
        { id: uid(), name: "Meditate", emoji: "🧘", color: "neon-cyan", history: {}, createdAt: new Date().toISOString() },
        { id: uid(), name: "No social media", emoji: "🚫", color: "neon-pink", history: {}, createdAt: new Date().toISOString() },
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
          role: "ai",
          text: "I'm your productivity copilot. I see your tasks, habits, and focus patterns. Ask me anything — or let me suggest your next move.",
          createdAt: new Date().toISOString(),
        },
      ],
      playlistImports: [],
      xp: 1240,
      level: 7,
      focusSessions: getInitialFocusSessions(), // deterministic, no random
      streakCount: 12,
      wallpaper: {
        theme: "neon",
        opacity: 0.85,
        showTasks: true,
        showStreak: true,
        showQuote: true,
        showStats: true,
        accent: "purple",
        font: "geist",
      },
      userName: "Operator",

      addTask: (t) => set((s) => ({
        tasks: [{ ...t, id: uid(), completed: false, createdAt: new Date().toISOString() }, ...s.tasks],
      })),
      toggleTask: (id) => set((s) => {
        const tasks = s.tasks.map((t) => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t);
        const becameDone = tasks.find((t) => t.id === id)?.completed;
        return { tasks, xp: s.xp + (becameDone ? 25 : -25) };
      }),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })),

      addHabit: (h) => set((s) => ({ habits: [...s.habits, { ...h, id: uid(), history: {}, createdAt: new Date().toISOString() }] })),
      toggleHabit: (id, date) => set((s) => ({
        habits: s.habits.map((h) => h.id === id ? { ...h, history: { ...h.history, [date]: !h.history[date] } } : h),
      })),
      deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

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
      updateGoal: (id, patch) => set((s) => ({
        goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g),
      })),
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

      setLifeContext: (context) => set({ lifeContext: context }),
      updateLifeContext: (patch) => set((s) => ({ lifeContext: { ...s.lifeContext, ...patch } })),

      saveBriefing: (briefing) => set((s) => {
        const existing = s.dailyBriefings.filter((b) => b.date !== briefing.date);
        return { dailyBriefings: [briefing, ...existing] };
      }),
      getBriefing: (date) => get().dailyBriefings.find((b) => b.date === date),

      recordBehavior: (patch) => set((s) => ({ behavior: { ...s.behavior, ...patch } })),

      addAssistantMessage: (message) => set((s) => ({
        assistantMessages: [
          ...s.assistantMessages,
          { ...message, id: uid(), createdAt: new Date().toISOString() },
        ],
      })),
      clearAssistantMessages: () => set({ assistantMessages: [] }),

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

      logFocus: (minutes) => set((s) => {
        const d = today();
        const existing = s.focusSessions.find((f) => f.date === d);
        const sessions = existing
          ? s.focusSessions.map((f) => f.date === d ? { ...f, minutes: f.minutes + minutes } : f)
          : [...s.focusSessions, { date: d, minutes }];
        return { focusSessions: sessions, xp: s.xp + minutes * 2 };
      }),
      setWallpaper: (patch) => set((s) => ({ wallpaper: { ...s.wallpaper, ...patch } })),
      setUserName: (name) => set({ userName: name }),
    }),
    { name: "walltask-ai-store" }
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