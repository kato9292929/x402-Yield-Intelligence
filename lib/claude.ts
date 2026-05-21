import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

async function complete(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    return res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  } catch {
    return null;
  }
}

/**
 * Ask Claude for a JSON object. Returns `fallback` whenever the key is
 * missing, the call fails, or the reply cannot be parsed.
 */
export async function askClaudeJSON<T>(
  system: string,
  user: string,
  fallback: T,
  maxTokens = 1024,
): Promise<T> {
  const text = await complete(
    `${system}\n\nReply with a single valid JSON object and nothing else.`,
    user,
    maxTokens,
  );
  if (!text) return fallback;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(match[0]) as Partial<T>) };
  } catch {
    return fallback;
  }
}

/**
 * Ask Claude for free-form text. Returns `fallback` when unavailable.
 */
export async function askClaudeText(
  system: string,
  user: string,
  fallback: string,
  maxTokens = 2048,
): Promise<string> {
  const text = await complete(system, user, maxTokens);
  return text && text.length > 0 ? text : fallback;
}

export function claudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
