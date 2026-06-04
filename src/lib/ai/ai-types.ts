import type { LifeCategory, Priority } from "@/lib/store";

export interface AiLifeContext {
  collegeTimetable?: { day: string; start: string; end: string; label: string }[];
  exams?: { title: string; date: string; course?: string }[];
  internships?: { company: string; role: string; startDate?: string; endDate?: string; status?: string }[];
  sleepSchedule?: { bedtime: string; wakeup: string };
  preferredStudyHours?: { start: string; end: string };
  placementGoals?: string[];
}

export interface AiContext {
  userName: string;
  today: string;
  tasks: {
    id: string;
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    priority: Priority;
    category: string;
    focusMinutes?: number;
    tags?: string[];
    completed: boolean;
  }[];
  habits: { id: string; name: string; emoji: string; doneToday: boolean }[];
  focusToday: number;
  streakCount: number;
  goals: { id: string; title: string; progress: number; deadline?: string; category: LifeCategory; status: string }[];
  lifeContext: AiLifeContext;
  recentMessages: { role: "user" | "ai"; text: string }[];
  playlistImports: { id: string; title: string; items: { index: number; title: string; durationMinutes: number | null }[] }[];
}

export type AiAction =
  | {
      type: "create_task";
      payload: {
        title: string;
        description?: string;
        dueDate?: string;
        dueTime?: string;
        priority?: Priority;
        category?: string;
        focusMinutes?: number;
        tags?: string[];
      };
    }
  | {
      type: "update_task";
      payload: {
        id: string;
        patch: {
          title?: string;
          description?: string;
          dueDate?: string;
          dueTime?: string;
          priority?: Priority;
          category?: string;
          focusMinutes?: number;
          tags?: string[];
          completed?: boolean;
        };
      };
    }
  | {
      type: "delete_task";
      payload: { id: string };
    }
  | {
      type: "create_goal";
      payload: { title: string; description?: string; deadline?: string; category?: LifeCategory };
    }
  | {
      type: "set_context";
      payload: AiLifeContext;
    };

export interface AiResponse {
  response: string;
  actions: AiAction[];
}
