import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AiContext, AiResponse } from "@/lib/ai/ai-types";

const inputSchema = z.object({
  message: z.string().min(1),
  context: z.any(),
});

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const { runAssistant } = await import("@/lib/ai/ai-engine.server");
    const response = await runAssistant(data.message, data.context as AiContext);
    return response as AiResponse;
  });
