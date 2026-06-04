import type { GeneratedPlan, PlanItem } from "@/components/PlanConfirmation";
import type { AiContext } from "@/lib/ai/ai-types";
import type { Priority } from "@/lib/store";
import {
  requestTaskAssistant,
  safeParseJson,
  type TaskDraft,
  type TaskPlanData,
  type TaskPlanItem,
} from "@/lib/ai/task-ai.shared";
import { extractRoadmapSource } from "@/lib/api/roadmap-source.functions";
import { addLocalDays, formatLocalDate } from "@/lib/date";

const LECTURE_PATTERN = /(?:^|\s)(?:\d+\s+)?true\s+(\d{1,2}:\d{2})\s+Now playing\s+/gi;
const ROADMAP_HINTS = [
  /this is all video/i,
  /make a road map/i,
  /make a roadmap/i,
  /build a roadmap/i,
  /make me a roadmap/i,
];

function normalizeTitle(input: string) {
  return (
    input
      .replace(/\s+/g, " ")
      .replace(/\b(?:plan|roadmap|schedule|today|week|day|my|please)\b/gi, "")
      .trim() || "Generated Plan"
  );
}

interface ExtractedLecture {
  title: string;
  durationMinutes: number | null;
}

function parseDurationLabel(label: string) {
  const parts = label.split(":").map((segment) => Number(segment));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }
  return null;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function extractRequestedDays(input: string) {
  const match = input.match(/(\d+)\s*days?\b/i);
  return match ? Number(match[1]) : undefined;
}

function extractTimeWindow(input: string) {
  const match = input.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!match) return null;

  const parseClock = (value: string) => {
    const timeMatch = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!timeMatch) return null;

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    const meridiem = timeMatch[3]?.toLowerCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  };

  const start = parseClock(match[1]);
  const end = parseClock(match[2]);
  if (!start || !end) return null;

  return {
    start: `${String(start.hours).padStart(2, "0")}:${String(start.minutes).padStart(2, "0")}`,
    end: `${String(end.hours).padStart(2, "0")}:${String(end.minutes).padStart(2, "0")}`,
  };
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getDueTimeForTask(
  timeWindow: { start: string; end: string } | null,
  index: number,
  count: number,
) {
  if (!timeWindow) return undefined;
  if (count <= 1) return timeWindow.start;

  const startMinutes = timeToMinutes(timeWindow.start);
  const endMinutes = timeToMinutes(timeWindow.end);
  const span = endMinutes > startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
  const slot = Math.max(1, Math.floor(span / Math.max(1, count)));
  return minutesToTime(startMinutes + slot * index);
}

function stripRoadmapPromptNoise(value: string) {
  let result = value;
  for (const hint of ROADMAP_HINTS) {
    const index = result.search(hint);
    if (index !== -1) {
      result = result.slice(0, index);
    }
  }
  return result.trim();
}

function cleanLectureTitle(rawTitle: string) {
  return stripRoadmapPromptNoise(rawTitle)
    .replace(/\s+\|\|\s*Episode\s*[-–]?\s*\d+\s*$/i, "")
    .replace(/\s+\d+\s*$/i, "")
    .replace(/^\d+\s+/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLectures(input: string): ExtractedLecture[] {
  const matches = Array.from(input.matchAll(LECTURE_PATTERN));
  if (matches.length === 0) return [];

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const nextStart = matches[index + 1]?.index ?? input.length;
      const rawTitle = input.slice(start, nextStart).trim();
      const title = cleanLectureTitle(rawTitle) || `Lecture ${index + 1}`;
      return {
        title,
        durationMinutes: parseDurationLabel(match[1]) ?? null,
      };
    })
    .filter((lecture) => lecture.title.length > 0);
}

function deriveRoadmapTitle(goal: string, lectures: ExtractedLecture[]) {
  const firstTitle = lectures[0]?.title;
  if (firstTitle) {
    return (
      firstTitle
        .replace(/^let'?s learn\s+/i, "")
        .replace(/^learn\s+/i, "")
        .replace(/^watch\s+/i, "")
        .replace(/^now playing\s+/i, "")
        .trim() || normalizeTitle(goal)
    );
  }

  return normalizeTitle(goal);
}

function formatEstimatedCommitment(totalMinutes: number, targetDays: number) {
  const dailyMinutes = Math.max(1, Math.round(totalMinutes / Math.max(1, targetDays)));
  return `${formatMinutes(dailyMinutes)}/day`;
}

function buildLectureRoadmap(goal: string, lectures: ExtractedLecture[], targetDays: number) {
  const title = deriveRoadmapTitle(goal, lectures);
  const totalMinutes = lectures.reduce((sum, lecture) => sum + (lecture.durationMinutes ?? 0), 0);
  const items: TaskPlanItem[] = [];
  let lectureIndex = 0;

  for (let dayIndex = 0; dayIndex < targetDays && lectureIndex < lectures.length; dayIndex += 1) {
    const remainingLectures = lectures.length - lectureIndex;
    const remainingDays = targetDays - dayIndex;
    const lectureCount = Math.max(1, Math.ceil(remainingLectures / remainingDays));
    const dayLectures = lectures.slice(lectureIndex, lectureIndex + lectureCount);
    lectureIndex += dayLectures.length;

    const dayMinutes = dayLectures.reduce(
      (sum, lecture) => sum + (lecture.durationMinutes ?? 0),
      0,
    );
    const phase = `Day ${dayIndex + 1}`;
    const preview = dayLectures
      .slice(0, 3)
      .map((lecture) => lecture.title)
      .join(" · ");
    const overflow = dayLectures.length > 3 ? ` +${dayLectures.length - 3} more` : "";

    items.push({
      phase,
      description: `${dayLectures.length} lecture${dayLectures.length === 1 ? "" : "s"}${dayMinutes ? ` • ${formatMinutes(dayMinutes)}` : ""}${preview ? ` • ${preview}${overflow}` : ""}`,
      taskCount: dayLectures.length,
      taskTitles: dayLectures.map((lecture) => lecture.title),
      taskDurationsMinutes: dayLectures.map((lecture) => lecture.durationMinutes ?? 45),
    });
  }

  while (items.length < targetDays) {
    const phase = `Day ${items.length + 1}`;
    items.push({
      phase,
      description: "Review, revise, and catch up on missed lessons.",
      taskCount: 1,
      taskTitles: ["Review and catch-up block"],
      taskDurationsMinutes: [45],
    });
  }

  return {
    title,
    description: `${targetDays}-day roadmap built from ${lectures.length} lectures.`,
    duration: `${targetDays} days`,
    estimatedCommitment: formatEstimatedCommitment(
      totalMinutes || lectures.length * 45,
      targetDays,
    ),
    items,
    totalTasks: lectures.length,
  };
}

function hasUrl(input: string) {
  return /https?:\/\/[^\s<>"')]+/i.test(input);
}

function fallbackPlan(goal: string): TaskPlanData {
  const title = normalizeTitle(goal);
  return {
    title,
    description: `A practical roadmap for ${title.toLowerCase()}.`,
    duration: "7 days",
    estimatedCommitment: "2 hours/day",
    items: [
      {
        phase: "Foundation",
        description: "Set up the basics and clear the prerequisites.",
        taskCount: 2,
      },
      { phase: "Core Work", description: "Build the main skills or deliverables.", taskCount: 3 },
      { phase: "Consolidation", description: "Practice, refine, and fill the gaps.", taskCount: 2 },
    ],
  };
}

function normalizeItems(items: TaskPlanItem[]) {
  const cleaned = items
    .filter((item) => item?.phase?.trim())
    .slice(0, 8)
    .map((item) => ({
      phase: item.phase.trim(),
      description: item.description?.trim(),
      taskCount: Math.max(1, Math.round(item.taskCount ?? 1)),
      taskTitles: item.taskTitles?.filter(Boolean),
      taskDurationsMinutes: item.taskDurationsMinutes?.filter(
        (duration): duration is number => typeof duration === "number" && Number.isFinite(duration),
      ),
    }));

  return cleaned.length > 0 ? cleaned : fallbackPlan("goal").items;
}

export function buildTaskDrafts(
  plan: { title: string; items: TaskPlanItem[] },
  options?: { startDate?: string; timeWindow?: { start: string; end: string } | null },
): TaskDraft[] {
  const tasks: TaskDraft[] = [];
  const baseDate = options?.startDate ?? formatLocalDate();

  plan.items.forEach((item, dayIndex) => {
    const dueDate = addLocalDays(baseDate, dayIndex);
    const titles =
      item.taskTitles && item.taskTitles.length > 0
        ? item.taskTitles
        : Array.from(
            { length: Math.max(1, item.taskCount ?? 1) },
            (_, index) => `${item.phase} - Task ${index + 1}`,
          );

    titles.forEach((title, index) => {
      tasks.push({
        title,
        description: item.description,
        priority: "medium" as Priority,
        tags: ["ai-generated"],
        focusMinutes: item.taskDurationsMinutes?.[index] ?? 45,
        category: plan.title,
        dueDate,
        dueTime: getDueTimeForTask(options?.timeWindow ?? null, index, titles.length),
      });
    });
  });

  return tasks;
}

export async function generateTaskPlan(goal: string, context: AiContext) {
  const requestedDays = extractRequestedDays(goal) ?? 7;
  const lectures = extractLectures(goal);
  const timeWindow = extractTimeWindow(goal) ?? context.lifeContext.preferredStudyHours ?? null;
  const source = hasUrl(goal)
    ? await extractRoadmapSource({ data: { input: goal } }).catch(() => null)
    : null;
  const sourceLectures =
    source?.items?.map((item) => ({
      title: item.title,
      durationMinutes: item.durationMinutes,
    })) ?? [];

  if (source && (source.kind === "youtube_playlist" || sourceLectures.length >= 10)) {
    const roadmap = buildLectureRoadmap(source.title || goal, sourceLectures, requestedDays);
    return {
      plan: roadmap,
      tasks: buildTaskDrafts(roadmap, { startDate: context.today, timeWindow }),
      raw: JSON.stringify({ source, roadmap }),
    };
  }

  if (lectures.length >= 6) {
    const roadmap = buildLectureRoadmap(goal, lectures, requestedDays);
    return {
      plan: roadmap,
      tasks: buildTaskDrafts(roadmap, { startDate: context.today, timeWindow }),
      raw: JSON.stringify(roadmap),
    };
  }

  const prompt = [
    "You are an expert productivity strategist.",
    "Turn the user's goal into a concise roadmap.",
    "Return a JSON object in the response string only, with this shape:",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "duration": string,',
    '  "estimatedCommitment": string,',
    '  "items": [',
    '    { "phase": string, "description": string, "taskCount": number }',
    "  ]",
    "}",
    "Rules:",
    "- Prefer 3 to 8 phases.",
    "- Make each phase concrete and actionable.",
    "- If the goal implies a daily recurring study schedule, keep the roadmap daily and make each phase represent one day with one main task.",
    "- If the user gave a time window like 9 to 11 pm, assume daily tasks should fit inside that window.",
    "- If the user says 'from today' or 'every day', start on today's local date and spread across consecutive days.",
    "- Use taskCount values that feel realistic for the goal.",
    "- Keep the response free of markdown and extra commentary.",
    "",
    `User goal: ${goal}`,
    source
      ? [
          "",
          "Source details:",
          `Source title: ${source.title}`,
          `Source type: ${source.kind}`,
          source.url ? `Source URL: ${source.url}` : "",
          "Source summary:",
          source.summary || "(no summary available)",
          "Source items:",
          source.items
            .slice(0, 40)
            .map(
              (item, index) =>
                `${index + 1}. ${item.title}${item.durationMinutes ? ` (${item.durationMinutes}m)` : ""}`,
            )
            .join("\n"),
          "",
          "If the source already contains a lecture or chapter list, preserve those names in the roadmap.",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  ].join("\n");

  const raw = await requestTaskAssistant(prompt, context);
  const parsed = safeParseJson<TaskPlanData>(raw);
  const normalized = parsed
    ? { ...parsed, items: normalizeItems(parsed.items) }
    : fallbackPlan(goal);
  const plan: GeneratedPlan = {
    title: normalized.title?.trim() || normalizeTitle(goal),
    description: normalized.description?.trim(),
    duration: normalized.duration?.trim() || `${requestedDays} days`,
    estimatedCommitment: normalized.estimatedCommitment?.trim() || "2 hours/day",
    items: normalized.items.map(
      (item): PlanItem => ({
        phase: item.phase,
        description: item.description,
        taskCount: item.taskCount,
      }),
    ),
    totalTasks: normalized.items.reduce((sum, item) => sum + item.taskCount, 0),
  };

  const tasks = buildTaskDrafts(plan, { startDate: context.today, timeWindow });

  return { plan, tasks, raw };
}
