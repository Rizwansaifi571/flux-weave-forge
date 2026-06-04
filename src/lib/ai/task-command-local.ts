import type { GeneratedPlan } from "@/components/PlanConfirmation";
import type { AiContext } from "@/lib/ai/ai-types";
import type { TaskDraft } from "@/lib/ai/task-ai.shared";
import type { Priority } from "@/lib/store";
import { addLocalDays } from "@/lib/date";

function normalizeTitle(input: string) {
  const cleaned = input
    .replace(/\b(?:please|kindly|can you|could you|i want you to|i want|make|create|build|plan|task|tasks|roadmap|schedule)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "My Task";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractSubject(command: string) {
  const subjectMatch = command.match(/\bsubject\s+(.+?)(?:\s+\b(?:from|today|tomorrow|every day|daily|for|in)\b|$)/i);
  if (subjectMatch?.[1]) return subjectMatch[1].trim();

  const afterVerbMatch = command.match(
    /\b(?:study|learn|practice|read|work on|build|finish|complete|prepare for)\s+(.+?)(?:\s+\b(?:from|today|tomorrow|every day|daily|for|in)\b|$)/i,
  );
  if (afterVerbMatch?.[1]) return afterVerbMatch[1].trim();

  return normalizeTitle(command);
}

function extractDurationMinutes(command: string) {
  const match = command.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(value)) return undefined;
  return unit.startsWith("hour") || unit.startsWith("hr") ? Math.round(value * 60) : Math.round(value);
}

function parseClockPart(raw: string, fallbackMeridiem?: "am" | "pm") {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = (match[3]?.toLowerCase() as "am" | "pm" | undefined) ?? fallbackMeridiem;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

function extractTimeWindow(command: string, preferred?: { start: string; end: string }) {
  const match = command.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!match) return preferred ?? null;

  const endHint = match[2].match(/\b(am|pm)\b/i)?.[1]?.toLowerCase() as "am" | "pm" | undefined;
  const start = parseClockPart(match[1], endHint);
  const end = parseClockPart(match[2], start ? (match[1].match(/\b(am|pm)\b/i)?.[1]?.toLowerCase() as "am" | "pm" | undefined) : undefined);
  if (!start || !end) return preferred ?? null;

  return {
    start: `${String(start.hours).padStart(2, "0")}:${String(start.minutes).padStart(2, "0")}`,
    end: `${String(end.hours).padStart(2, "0")}:${String(end.minutes).padStart(2, "0")}`,
  };
}

function formatClock(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function extractStartDate(command: string, today: string) {
  if (/\btomorrow\b/i.test(command)) {
    return addLocalDays(today, 1);
  }
  return today;
}

function extractTotalDays(command: string) {
  const explicit = command.match(/for\s+(\d+)\s*days?\b/i);
  if (explicit) return Math.max(1, Number(explicit[1]));
  if (/\bevery day\b|\bdaily\b|\beach day\b/i.test(command)) return 7;
  return 1;
}

function buildTaskTitle(subject: string, command: string) {
  if (/\b(study|learn|practice|read)\b/i.test(command)) {
    return `Study ${titleCase(subject)}`;
  }
  if (/\b(work on|build|create|make)\b/i.test(command)) {
    return titleCase(subject);
  }
  return titleCase(subject);
}

function inferPriority(command: string): Priority {
  if (/\burgent\b|\bimportant\b|\bhigh priority\b/i.test(command)) return "high";
  if (/\blow priority\b|\bwhen free\b/i.test(command)) return "low";
  return "medium";
}

function inferCategory(command: string) {
  if (/\b(study|learn|course|lecture|class)\b/i.test(command)) return "Study";
  if (/\b(work|build|project|code)\b/i.test(command)) return "Work";
  return "General";
}

function buildDayTitles(subject: string, totalDays: number) {
  return Array.from({ length: totalDays }, (_, index) => {
    if (totalDays === 1) return titleCase(subject);
    return `Day ${index + 1}: ${titleCase(subject)}`;
  });
}

export function createRecurringStudyTasks(command: string, context: AiContext) {
  const looksLikeRecurringStudy =
    /\b(every day|daily|each day)\b/i.test(command) ||
    /\bfrom today\b/i.test(command) ||
    /\bfrom tomorrow\b/i.test(command);

  if (!looksLikeRecurringStudy && !/\bstudy|learn|practice|read\b/i.test(command)) {
    return null;
  }

  const subject = extractSubject(command);
  const totalDays = extractTotalDays(command);
  const startDate = extractStartDate(command, context.today);
  const timeWindow = extractTimeWindow(command, context.lifeContext.preferredStudyHours);
  const focusMinutes = extractDurationMinutes(command) ?? 120;
  const priority = inferPriority(command);
  const category = inferCategory(command);
  const dueTime = timeWindow ? timeWindow.start : undefined;
  const startTimeLabel = timeWindow ? `${timeWindow.start} to ${timeWindow.end}` : "your preferred study window";

  const tasks: TaskDraft[] = Array.from({ length: totalDays }, (_, index) => {
    const dueDate = addLocalDays(startDate, index);
    const title = buildTaskTitle(subject, command);
    const phaseLabel = totalDays > 1 ? `Daily block ${index + 1}` : "Study block";

    return {
      title,
      description: `${phaseLabel} for ${titleCase(subject)}${timeWindow ? ` (${startTimeLabel})` : ""}`,
      priority,
      tags: ["ai-generated", "study", "daily"],
      focusMinutes,
      category,
      dueDate,
      dueTime,
    };
  });

  return {
    tasks,
    message:
      totalDays > 1
        ? `Created ${totalDays} daily tasks for ${titleCase(subject)} starting ${startDate}.`
        : `Created a study task for ${titleCase(subject)}.`,
  };
}

export function buildLocalDayPlan(context: AiContext) {
  const sorted = [...context.tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => {
      const overdueA = a.dueDate && a.dueDate < context.today ? 0 : 1;
      const overdueB = b.dueDate && b.dueDate < context.today ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const top = sorted.slice(0, 4);
  const focusWindow = context.lifeContext.preferredStudyHours;
  return [
    `Today's plan for ${context.userName}:`,
    top.length
      ? top
          .map((task, index) => `${index + 1}. ${task.title}${task.dueTime ? ` at ${task.dueTime}` : ""}`)
          .join("\n")
      : "1. Start with one high-value task and protect your study window.",
    `Use ${focusWindow.start} to ${focusWindow.end} as your main focus block.`,
  ].join("\n");
}

export function buildLocalWeekPlan(context: AiContext) {
  const pending = context.tasks.filter((task) => !task.completed);
  const overdue = pending.filter((task) => task.dueDate && task.dueDate < context.today);
  const high = pending.filter((task) => task.priority === "high").slice(0, 3);
  return [
    `Weekly plan for ${context.userName}:`,
    `- Overdue tasks: ${overdue.length}`,
    `- High priority focus: ${high.length ? high.map((task) => task.title).join(", ") : "none set"}`,
    `- Break the week into 1 deep work block + 1 light block per day.`,
  ].join("\n");
}

export function buildLocalPrioritizeText(context: AiContext) {
  const pending = context.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
      const p = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (p !== 0) return p;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    })
    .slice(0, 3);

  if (!pending.length) return "You’re clear right now. Create the next task or protect a study block.";

  return [
    "Top priorities:",
    ...pending.map((task, index) => `${index + 1}. ${task.title}${task.dueDate ? ` (${task.dueDate})` : ""}`),
  ].join("\n");
}

export function buildLocalAnalysisText(context: AiContext) {
  const completed = context.tasks.filter((task) => task.completed).length;
  const overdue = context.tasks.filter((task) => task.dueDate && task.dueDate < context.today && !task.completed).length;

  return [
    "Productivity snapshot:",
    `- Completed tasks: ${completed}`,
    `- Overdue tasks: ${overdue}`,
    `- Streak: ${context.streakCount} day${context.streakCount === 1 ? "" : "s"}`,
    `- Focus logged today: ${context.focusToday} minutes`,
  ].join("\n");
}

export function buildLocalRoadmapFallback(command: string, context: AiContext) {
  const title = titleCase(normalizeTitle(command));
  const plan: GeneratedPlan = {
    title,
    description: `A practical roadmap for ${title.toLowerCase()}.`,
    duration: "7 days",
    estimatedCommitment: "2 hours/day",
    items: [
      { phase: "Foundation", description: "Set up the basics and clear prerequisites.", taskCount: 2 },
      { phase: "Core Study", description: "Work through the main learning blocks.", taskCount: 3 },
      { phase: "Practice", description: "Apply what you learned with hands-on work.", taskCount: 3 },
      { phase: "Review", description: "Fix weak spots and close the gaps.", taskCount: 2 },
      { phase: "Finish Strong", description: "Polish, revise, and lock in the routine.", taskCount: 2 },
    ],
    totalTasks: 12,
  };

  const tasks: TaskDraft[] = plan.items.flatMap((item, index) => {
    const dueDate = addLocalDays(context.today, index);
    return Array.from({ length: item.taskCount ?? 1 }, (_, taskIndex) => ({
      title: `${item.phase} - Task ${taskIndex + 1}`,
      description: item.description,
      priority: "medium" as Priority,
      tags: ["ai-generated"],
      focusMinutes: 45,
      category: title,
      dueDate,
    }));
  });

  return { plan, tasks };
}
