import type { GeneratedPlan, PlanItem } from "@/components/PlanConfirmation";
import type { AiContext, AiResponse } from "@/lib/ai/ai-types";
import { runAssistant } from "@/lib/ai/ai-engine.server";

export interface ParsedCommand {
  intent: "goal_plan" | "plan_day" | "plan_week" | "reschedule" | "break_down" | "prioritize" | "analyze";
  target?: string;
  duration?: string;
}

// Map natural language to structured commands
export function parseCommand(input: string): ParsedCommand {
  const lower = input.toLowerCase();

  if (
    lower.includes("plan my day") ||
    lower.includes("today") ||
    lower.includes("hours today")
  ) {
    return { intent: "plan_day" };
  }

  if (lower.includes("plan my week") || lower.includes("this week")) {
    return { intent: "plan_week" };
  }

  if (
    lower.includes("reschedule") ||
    lower.includes("overdue") ||
    lower.includes("couldn't")
  ) {
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

  if (
    lower.includes("analyze") ||
    lower.includes("productivity") ||
    lower.includes("report")
  ) {
    return { intent: "analyze" };
  }

  // Default to goal planning
  return { intent: "goal_plan", target: input };
}

// Generate a plan from AI response
export function generatePlanFromResponse(response: AiResponse): GeneratedPlan {
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
  "plan-day": "Plan my day - suggest the best tasks to work on given my available time",
  "plan-week": "Create a weekly plan - break down my major goals into daily tasks",
  "reschedule":
    "I missed some tasks yesterday - intelligently reschedule my work to keep deadlines intact",
  "break-down": "Take my current goals and break them into concrete, actionable tasks",
  "prioritize": "What should I work on next? Analyze my priorities and suggest the best task",
  "analyze": "Analyze my productivity patterns this week - what can I improve?",
};
