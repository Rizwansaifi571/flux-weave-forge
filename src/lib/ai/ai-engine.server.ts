import type { AiAction, AiContext, AiResponse } from "@/lib/ai/ai-types";
import { getGroqCompletion } from "@/lib/api/ai.server";

function buildSystemPrompt(context: AiContext) {
  const contextJson = JSON.stringify(context, null, 2);

  return [
    "You are WallTask AI, a context-aware productivity assistant.",
    "You must respond with valid JSON only. No markdown, no code fences.",
    "Schema:",
    "{\"response\": string, \"actions\": AiAction[]}",
    "",
    "Allowed actions:",
    "- create_task: { title, description?, dueDate?, priority?, category?, focusMinutes?, tags? }",
    "- update_task: { id, patch: { title?, description?, dueDate?, priority?, category?, focusMinutes?, tags?, completed? } }",
    "- delete_task: { id }",
    "- create_goal: { title, description?, deadline?, category? }",
    "- set_context: { sleepSchedule?, preferredStudyHours?, exams?, internships?, collegeTimetable?, placementGoals? }",
    "",
    "Rules:",
    "- Use YYYY-MM-DD for any date.",
    "- Only reference task IDs that exist in the context.",
    "- If you need a task ID and it is missing, ask a clarifying question and return no actions.",
    "- If the user shares a link or playlist URL, you cannot access it. Ask the user to paste the list or details, and return no actions.",
    "- Keep actions minimal and directly tied to the user request.",
      "- If playlistImports exist, use them as the source of truth for lecture indexes (e.g. 'continue from lecture 62').",
    "",
    "Context:",
    contextJson,
  ].join("\n");
}

function extractJson(raw: string) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw;
}

function normalizeActions(actions: unknown): AiAction[] {
  if (!Array.isArray(actions)) return [];
  const allowed = new Set(["create_task", "update_task", "delete_task", "create_goal", "set_context"]);
  return actions.filter((action) => {
    return action && typeof action === "object" && allowed.has((action as { type?: string }).type ?? "");
  }) as AiAction[];
}

export async function runAssistant(userMessage: string, context: AiContext): Promise<AiResponse> {
  const systemPrompt = buildSystemPrompt(context);
  const raw = await getGroqCompletion({ userPrompt: userMessage, systemPrompt });

  if (!raw) {
    return { response: "I did not receive a response from the AI.", actions: [] };
  }

  try {
    const jsonText = extractJson(raw);
    const parsed = JSON.parse(jsonText) as { response?: string; actions?: unknown };
    return {
      response: typeof parsed.response === "string" ? parsed.response : raw,
      actions: normalizeActions(parsed.actions),
    };
  } catch {
    return { response: raw, actions: [] };
  }
}
