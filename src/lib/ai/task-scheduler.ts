import type { AiContext } from "@/lib/ai/ai-types";
import { requestTaskAssistant } from "@/lib/ai/task-ai.shared";

function extractAvailableMinutes(command: string) {
  const match = command.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/i);
  if (!match) return undefined;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("hour") || unit.startsWith("hr")) {
    return Math.round(value * 60);
  }

  return Math.round(value);
}

export async function planDay(command: string, context: AiContext) {
  const availableMinutes = extractAvailableMinutes(command);
  const prompt = [
    "You are a day planner.",
    "Use the user's current tasks to suggest the best order for today.",
    "Mention time blocks, what to start with, and what to avoid if time runs short.",
    "Return a clear, practical plan in plain text.",
    "",
    `Available time: ${availableMinutes ? `${availableMinutes} minutes` : "about 3 hours"}`,
    `User request: ${command}`,
  ].join("\n");

  return requestTaskAssistant(prompt, context);
}
