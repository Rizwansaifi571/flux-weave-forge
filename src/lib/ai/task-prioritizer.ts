import type { AiContext } from "@/lib/ai/ai-types";
import { requestTaskAssistant } from "@/lib/ai/task-ai.shared";

export async function prioritizeTasks(command: string, context: AiContext) {
  const prompt = [
    "You are a productivity assistant.",
    "Rank the pending tasks for the user and explain the best next move.",
    "Return a short, direct response with the top 5 tasks and a one-sentence reason for each.",
    "If any task should be postponed, say so briefly.",
    "",
    `User request: ${command}`,
  ].join("\n");

  return requestTaskAssistant(prompt, context);
}
