import type { AiAction, AiContext, AiResponse } from "@/lib/ai/ai-types";
import { getGroqCompletion } from "@/lib/api/ai.server";

function buildSystemPrompt(context: AiContext, userMessage: string) {
  if (
    userMessage.includes("premium habit designer") ||
    userMessage.includes("AI habit operating system")
  ) {
    return [
      "You are a premium habit design assistant.",
      "You must respond with valid JSON matching the requested schema.",
      "No conversational text outside the JSON, no markdown formatting, no code fences, only the JSON object.",
    ].join("\n");
  }

  const contextJson = JSON.stringify(context, null, 2);

  return [
    "You are WallTask AI, a premium task operating system and personal productivity assistant.",
    "You must respond with valid JSON only. No markdown, no code fences.",
    "Schema:",
    "{\"response\": string, \"actions\": AiAction[]}",
    "",
    "Allowed actions:",
    "- create_task: { title, description?, dueDate?, dueTime?, priority?, category?, focusMinutes?, tags? }",
    "- update_task: { id, patch: { title?, description?, dueDate?, dueTime?, priority?, category?, focusMinutes?, tags?, completed? } }",
    "- delete_task: { id }",
    "- create_goal: { title, description?, deadline?, category? }",
    "- set_context: { sleepSchedule?, preferredStudyHours?, exams?, internships?, collegeTimetable?, placementGoals? }",
    "",
    "Rules:",
    "- Use YYYY-MM-DD for any date and HH:mm for dueTime.",
    "- If the user mentions a daily time window such as 9 to 11 pm, create or update tasks with dueTime values inside that window and spread work across the requested days instead of stacking everything on one date.",
    "- IMPORTANT: Unless the user explicitly provides a time window (e.g. 8 pm to 9 pm), do NOT set 'dueTime' for tasks. Leave 'dueTime' blank/unset by default.",
    "- If the user asks to reschedule overdue work, update every matching unfinished task so the workload is distributed across upcoming days.",
    "- If the user asks to edit, rename, complete, postpone, or delete a task, use the relevant task action directly instead of answering only in text.",
    "- Only reference task IDs that exist in the context.",
    "- If you need a task ID and it is missing, ask a clarifying question and return no actions.",
    "- If the user shares a link or playlist URL without any content, you cannot access it — respond asking them to paste the details instead.",
    "- If the user pastes a raw list of YouTube items (often containing lines like 'true', durations like '22:22', or 'Now playing'), completely IGNORE those metadata lines.",
    "- ONLY extract the actual video/lecture titles (e.g., 'Performance: Reflow && Repaint in JS') and create ONE task per title.",
    "- When creating tasks from a pasted list, use today's date as dueDate unless specified otherwise. Do not set dueTime. Set priority to medium.",
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
  const systemPrompt = buildSystemPrompt(context, userMessage);
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
