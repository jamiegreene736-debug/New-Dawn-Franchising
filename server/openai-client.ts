import OpenAI from "openai";

function resolveOpenAIConfig() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY to use this feature.",
    );
  }

  return {
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  };
}

export function createOpenAIClient(): OpenAI {
  return new OpenAI(resolveOpenAIConfig());
}

export function createLazyOpenAIClient(): OpenAI {
  let client: OpenAI | null = null;
  return new Proxy({} as OpenAI, {
    get(_target, prop, receiver) {
      client ??= createOpenAIClient();
      return Reflect.get(client, prop, receiver);
    },
  });
}
