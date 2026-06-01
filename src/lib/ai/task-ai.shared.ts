import { askAssistant } from "@/lib/api/assistant.functions";
import type { PlanItem } from "@/components/PlanConfirmation";
import type { AiContext } from "@/lib/ai/ai-types";

export interface TaskPlanItem extends PlanItem {
  taskCount?: number;
  taskTitles?: string[];
  taskDurationsMinutes?: number[];
}

export interface TaskPlanData {
  title: string;
  description?: string;
  duration?: string;
  estimatedCommitment?: string;
  items: TaskPlanItem[];
}

export interface TaskDraft {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  tags: string[];
  focusMinutes: number;
  category: string;
  dueDate?: string;
}

export interface CoachInsight {
  mostProductiveHour: string;
  weakArea: string;
  suggestion: string;
}

export function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  return cleaned.slice(first, last + 1);
}

export function safeParseJson<T>(raw: string): T | null {
  const directCandidates = [
    raw,
    raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim(),
  ];

  for (const candidate of directCandidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Keep trying fallbacks below.
    }
  }

  const extracted = extractJsonObject(raw);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted) as T;
  } catch {
    return null;
  }
}

export async function requestTaskAssistant(message: string, context: AiContext) {
  const response = await askAssistant({ data: { message, context } });
  return response.response;
}
