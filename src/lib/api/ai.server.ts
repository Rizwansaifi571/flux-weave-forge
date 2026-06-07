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

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  if (systemPrompt) {
    messages.unshift({ role: "system", content: systemPrompt });
  }

  const attemptCompletion = async (targetModel: string, useSecondaryKey: boolean = false) => {
    const key = useSecondaryKey ? config.groqApiKey1 : config.groqApiKey;
    if (!key) throw new Error(`Missing ${useSecondaryKey ? "secondary " : ""}API Key`);

    console.log(`[DEBUG] Attempting with key starting with: ${key.substring(0, 10)}... (isSecondary: ${useSecondaryKey})`);

    const groq = new Groq({ apiKey: key });
    return await groq.chat.completions.create({
      messages,
      model: targetModel,
    });
  };

  try {
    console.log(`[groq] Attempting completion using model: ${model} (Primary Key)`);
    const completion = await attemptCompletion(model, false);
    console.log(`[groq] Success with model: ${model}`);
    return completion.choices[0]?.message?.content ?? "";
  } catch (error: any) {
    console.warn(`[groq] Model ${model} failed with primary key:`, error?.message || error);
    
    // Try secondary key if it was a rate limit or general error (and secondary key exists)
    if (config.groqApiKey1) {
      try {
        console.log(`[groq] Attempting completion using model: ${model} (Secondary Key)`);
        const completion = await attemptCompletion(model, true);
        console.log(`[groq] Success with model: ${model} (Secondary Key)`);
        return completion.choices[0]?.message?.content ?? "";
      } catch (secondaryError: any) {
        console.warn(`[groq] Model ${model} failed with secondary key:`, secondaryError?.message || secondaryError);
      }
    }

    // Fallback to smaller model if main model failed on both keys
    if (model !== FALLBACK_MODEL) {
      console.warn(`[groq] Attempting fallback to model: ${FALLBACK_MODEL}`);
      try {
        const completion = await attemptCompletion(FALLBACK_MODEL, false);
        console.log(`[groq] Success with fallback model: ${FALLBACK_MODEL}`);
        return completion.choices[0]?.message?.content ?? "";
      } catch (fallbackError: any) {
        if (config.groqApiKey1) {
          try {
             const completion = await attemptCompletion(FALLBACK_MODEL, true);
             console.log(`[groq] Success with fallback model: ${FALLBACK_MODEL} (Secondary Key)`);
             return completion.choices[0]?.message?.content ?? "";
          } catch (e: any) {}
        }
        console.error(`[groq] Fallback model ${FALLBACK_MODEL} failed completely:`, fallbackError?.message || fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}
