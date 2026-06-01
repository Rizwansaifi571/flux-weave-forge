import type { AiContext } from "@/lib/ai/ai-types";
import { requestTaskAssistant } from "@/lib/ai/task-ai.shared";

export async function analyzeProductivity(command: string, context: AiContext) {
  const prompt = [
    "You are a productivity analyst.",
    "Review the user's current task and focus patterns.",
    "Return a short report with strengths, weaknesses, and 2 to 4 practical suggestions.",
    "Keep it helpful, specific, and concise.",
    "",
    `User request: ${command}`,
  ].join("\n");

  return requestTaskAssistant(prompt, context);
}
