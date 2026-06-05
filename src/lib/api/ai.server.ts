import Groq from "groq-sdk";
import { config } from "@/lib/config.server";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

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

  try {
    console.log(`[groq] Attempting completion using model: ${model}`);
    const completion = await groq.chat.completions.create({
      messages,
      model,
    });
    console.log(`[groq] Success with model: ${model}`);
    return completion.choices[0]?.message?.content ?? "";
  } catch (error: any) {
    console.error(`[groq] Model ${model} failed:`, error?.message || error);

    if (model !== FALLBACK_MODEL) {
      console.warn(`[groq] Attempting fallback to model: ${FALLBACK_MODEL}`);
      try {
        const completion = await groq.chat.completions.create({
          messages,
          model: FALLBACK_MODEL,
        });
        console.log(`[groq] Success with fallback model: ${FALLBACK_MODEL}`);
        return completion.choices[0]?.message?.content ?? "";
      } catch (fallbackError: any) {
        console.error(`[groq] Fallback model ${FALLBACK_MODEL} failed:`, fallbackError?.message || fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}
