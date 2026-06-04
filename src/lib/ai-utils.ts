import type { GeneratedPlan, PlanItem } from "@/components/PlanConfirmation";
import type { AiResponse } from "@/lib/ai/ai-types";

export interface ParsedCommand {
  intent:
    | "goal_plan"
    | "plan_day"
    | "plan_week"
    | "reschedule"
    | "break_down"
    | "prioritize"
    | "analyze";
  target?: string;
  duration?: string;
}

// Map natural language to structured commands
export function parseCommand(input: string): ParsedCommand {
  const lower = input.toLowerCase();

  if (
    lower.includes("plan my day") ||
    lower.includes("what should i do today") ||
    lower.includes("today's") ||
    lower.includes("hours today") ||
    lower.includes("time today") ||
    /\b(i have|available)\b.*\b(hours?|hrs?|minutes?|mins?)\b/i.test(lower)
  ) {
    return { intent: "plan_day" };
  }

  if (lower.includes("plan my week") || lower.includes("this week")) {
    return { intent: "plan_week" };
  }

  if (lower.includes("reschedule") || lower.includes("couldn't") || lower.includes("missed")) {
    return { intent: "reschedule" };
  }

  if (lower.includes("break down") || lower.includes("decompose")) {
    return { intent: "break_down", target: input };
  }

  if (
    lower.includes("prioritize") ||
    lower.includes("what should i do next") ||
    lower.includes("next move")
  ) {
    return { intent: "prioritize" };
  }

  if (lower.includes("analyze") || lower.includes("productivity") || lower.includes("report")) {
    return { intent: "analyze" };
  }

  // Default to goal planning
  return { intent: "goal_plan", target: input };
}

// Generate a plan from AI response
export function generatePlanFromResponse(response: AiResponse): GeneratedPlan {
  const structured = tryParseStructuredPlan(response.response);
  if (structured) {
    return structured;
  }

  const lines = response.response.split("\n").filter((l) => l.trim());

  const items: PlanItem[] = lines
    .filter((line) => line.match(/^(Week|Day|Phase|Step|Part)[\s:]/i))
    .slice(0, 8) // Limit to 8 items for UI
    .map((line, idx) => {
      const taskMatch = line.match(/(\d+)\s*(tasks?|items?|steps?)/i);
      return {
        phase: line.replace(/^(Week|Day|Phase|Step|Part)\s+\d+[\s:]*/, "").trim(),
        description: `Phase ${idx + 1}`,
        taskCount: taskMatch ? parseInt(taskMatch[1]) : undefined,
      };
    });

  const plan: GeneratedPlan = {
    title: extractTitle(response.response),
    description: extractDescription(response.response),
    items: items.length > 0 ? items : generateDefaultPlan(),
    totalTasks: calculateTotalTasks(response.response),
    duration: extractDuration(response.response),
    estimatedCommitment: "2-3 hours/day",
  };

  return plan;
}

function tryParseStructuredPlan(response: string): GeneratedPlan | null {
  const cleaned = response
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<GeneratedPlan> & { items?: PlanItem[] };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
      return null;
    }

    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Generated Plan",
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      duration: typeof parsed.duration === "string" ? parsed.duration : undefined,
      estimatedCommitment:
        typeof parsed.estimatedCommitment === "string"
          ? parsed.estimatedCommitment
          : "2-3 hours/day",
      items: parsed.items.slice(0, 8).map((item, idx) => ({
        phase: item.phase || `Phase ${idx + 1}`,
        description: item.description,
        taskCount: item.taskCount,
      })),
      totalTasks:
        typeof parsed.totalTasks === "number"
          ? parsed.totalTasks
          : parsed.items.reduce((sum, item) => sum + (item.taskCount ?? 1), 0),
    };
  } catch {
    return null;
  }
}

function extractTitle(response: string): string {
  const lines = response.split("\n");
  for (const line of lines) {
    if (line.includes("Project:") || line.includes("Plan:") || line.includes("Goal:")) {
      return line.replace(/(Project|Plan|Goal):\s*/i, "").trim();
    }
  }
  return "Generated Plan";
}

function extractDescription(response: string): string | undefined {
  const lines = response.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Description:")) {
      return lines[i].replace(/Description:\s*/i, "").trim();
    }
  }
  return undefined;
}

function calculateTotalTasks(response: string): number {
  const match = response.match(/(\d+)\s*(total\s+)?tasks?/i);
  return match ? parseInt(match[1]) : 15;
}

function extractDuration(response: string): string | undefined {
  const match = response.match(/(\d+)\s*(days?|weeks?|months?)/i);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return undefined;
}

function generateDefaultPlan(): PlanItem[] {
  return [
    { phase: "Foundation & Setup", taskCount: 3 },
    { phase: "Core Implementation", taskCount: 5 },
    { phase: "Advanced Features", taskCount: 4 },
    { phase: "Testing & Polish", taskCount: 3 },
    { phase: "Revision & Practice", taskCount: 2 },
  ];
}

// Quick action command templates
export const QUICK_ACTION_PROMPTS: Record<string, string> = {
  "plan-day": "Plan my day and place work into real time blocks based on my available hours",
  "plan-week": "Create a weekly plan and break my goals into balanced daily tasks",
  reschedule: "Reschedule all overdue tasks and spread the workload across upcoming days",
  "break-down": "Take my current goals and break them into concrete, actionable tasks",
  prioritize: "What should I work on next? Analyze my priorities and suggest the best task",
  analyze: "Analyze my productivity patterns this week and tell me what to improve",
  create: "Create a task plan for my goal and assign due dates and due times",
  edit: "Edit one of my tasks and update its time, date, or details",
};
