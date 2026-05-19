import OpenAI from "openai";

/** Many models wrap JSON in markdown fences; some return prose before/after. */
export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  const candidate = fence ? fence[1].trim() : trimmed;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
    throw new SyntaxError("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(objectStart, objectEnd + 1));
}

export async function chatCompletionJson(
  client: OpenAI,
  params: {
    model: string;
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    useJsonObjectFormat: boolean;
  },
): Promise<string | null> {
  const base = {
    model: params.model,
    temperature: 0.1,
    messages: params.messages,
  } as const;

  try {
    const completion = await client.chat.completions.create({
      ...base,
      ...(params.useJsonObjectFormat ? { response_format: { type: "json_object" as const } } : {}),
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    if (!params.useJsonObjectFormat) {
      throw err;
    }
    console.warn("[llm] chat.completions with response_format failed, retrying without:", err);
    const completion = await client.chat.completions.create(base);
    return completion.choices[0]?.message?.content ?? null;
  }
}
