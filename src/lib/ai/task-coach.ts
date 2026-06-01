import type { AiContext } from "@/lib/ai/ai-types";
import { requestTaskAssistant, safeParseJson, type CoachInsight } from "@/lib/ai/task-ai.shared";

const FALLBACK: CoachInsight = {
  mostProductiveHour: "Morning",
  weakArea: "Task follow-through",
  suggestion: "Pick one high-priority task and protect a 45-minute focus block for it today.",
};

export async function generateCoachInsight(context: AiContext) {
  const prompt = [
    "You are an AI productivity coach.",
    "Analyze the user's current tasks, streak, focus, and recent progress.",
    "Return a JSON object in the response string only, with this shape:",
    "{",
    '  "mostProductiveHour": string,',
    '  "weakArea": string,',
    '  "suggestion": string',
    "}",
    "Keep the suggestion specific and useful. No markdown.",
  ].join("\n");

  const raw = await requestTaskAssistant(prompt, context);
  const parsed = safeParseJson<Partial<CoachInsight>>(raw);

  return {
    mostProductiveHour: parsed?.mostProductiveHour?.trim() || FALLBACK.mostProductiveHour,
    weakArea: parsed?.weakArea?.trim() || FALLBACK.weakArea,
    suggestion: parsed?.suggestion?.trim() || FALLBACK.suggestion,
    raw,
  };
}
