import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Priority = "low" | "medium" | "high";
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
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
  history: Record<string, boolean>; // YYYY-MM-DD -> done
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

  logFocus: (minutes: number) => void;
  setWallpaper: (patch: Partial<WallpaperConfig>) => void;
  setUserName: (name: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

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
      xp: 1240,
      level: 7,
      focusSessions: Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().slice(0, 10), minutes: 40 + Math.floor(Math.random() * 120) };
      }),
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