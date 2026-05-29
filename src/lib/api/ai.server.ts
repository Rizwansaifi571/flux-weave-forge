import Groq from "groq-sdk";
import { config } from "@/lib/config.server";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export async function getGroqCompletion(params: {
  userPrompt: string;
  systemPrompt?: string;
  model?: string;
}) {
  const { userPrompt, systemPrompt, model = DEFAULT_MODEL } = params;

  if (!config.groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const groq = new Groq({
    apiKey: config.groqApiKey,
  });

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  if (systemPrompt) {
    messages.unshift({ role: "system", content: systemPrompt });
  }

  const completion = await groq.chat.completions.create({
    messages,
    model,
  });

  return completion.choices[0]?.message?.content ?? "";
}
