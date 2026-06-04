import type { AiAction } from "@/lib/ai/ai-types";
import type { GoalStatus, LifeCategory, Priority, Task } from "@/lib/store";

type CreateTaskInput = Omit<Task, "id" | "createdAt" | "completed">;

interface TaskActionHandlers {
  addTask?: (task: CreateTaskInput) => void;
  batchAddTasks?: (tasks: CreateTaskInput[]) => void;
  updateTask?: (id: string, patch: Partial<Task>) => void;
  deleteTask?: (id: string) => void;
  addGoal?: (goal: {
    title: string;
    description?: string;
    deadline?: string;
    category?: LifeCategory;
    status?: GoalStatus;
  }) => void;
  updateLifeContext?: (patch: Partial<{
    sleepSchedule: { bedtime: string; wakeup: string };
    preferredStudyHours: { start: string; end: string };
    exams: { title: string; date: string; course?: string }[];
    internships: {
      company: string;
      role: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    }[];
    collegeTimetable: { day: string; start: string; end: string; label: string }[];
    placementGoals: string[];
  }>) => void;
}

function normalizePriority(priority?: Priority): Priority {
  if (priority === "low" || priority === "high") return priority;
  return "medium";
}

export function applyAiActions(actions: AiAction[], handlers: TaskActionHandlers) {
  let appliedCount = 0;

  actions.forEach((action) => {
    if (action.type === "create_task" && handlers.addTask) {
      handlers.addTask({
        title: action.payload.title,
        description: action.payload.description,
        dueDate: action.payload.dueDate,
        dueTime: action.payload.dueTime,
        priority: normalizePriority(action.payload.priority),
        tags: action.payload.tags ?? [],
        focusMinutes: action.payload.focusMinutes ?? 45,
        category: action.payload.category ?? "Work",
      });
      appliedCount += 1;
      return;
    }

    if (action.type === "update_task" && handlers.updateTask) {
      handlers.updateTask(action.payload.id, action.payload.patch);
      appliedCount += 1;
      return;
    }

    if (action.type === "delete_task" && handlers.deleteTask) {
      handlers.deleteTask(action.payload.id);
      appliedCount += 1;
      return;
    }

    if (action.type === "create_goal" && handlers.addGoal) {
      handlers.addGoal({
        title: action.payload.title,
        description: action.payload.description ?? "",
        deadline: action.payload.deadline,
        category: action.payload.category ?? "career",
      });
      appliedCount += 1;
      return;
    }

    if (action.type === "set_context" && handlers.updateLifeContext) {
      handlers.updateLifeContext(action.payload);
      appliedCount += 1;
    }
  });

  return appliedCount;
}
