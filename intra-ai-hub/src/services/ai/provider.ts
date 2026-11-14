import "server-only";
import OpenAI, { AzureOpenAI } from "openai";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { content: string; model: string; tokensIn: number; tokensOut: number };

export interface AIProvider {
  readonly name: "openai" | "azure";
  chat(messages: ChatMessage[], opts?: { model?: string | null; temperature?: number }): Promise<ChatResult>;
  embed(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_DIMENSIONS = 1536;

class OpenAICompatible implements AIProvider {
  constructor(
    readonly name: "openai" | "azure",
    private client: OpenAI,
    private chatModel: string,
    private embeddingModel: string,
    private allowModelOverride: boolean,
  ) {}

  async chat(messages: ChatMessage[], opts: { model?: string | null; temperature?: number } = {}) {
    const model = (this.allowModelOverride && opts.model) || this.chatModel;
    const res = await this.client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
    });
    return {
      content: res.choices[0]?.message?.content ?? "",
      model: res.model ?? model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
    };
  }

  async embed(texts: string[]) {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      const res = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return out;
  }
}

let cached: AIProvider | null = null;

/** Escolhe o provedor por variável de ambiente. Nenhuma chave chega ao navegador. */
export function getAI(): AIProvider {
  if (cached) return cached;
  const provider = (process.env.AI_PROVIDER ?? (process.env.AZURE_OPENAI_ENDPOINT ? "azure" : "openai")).toLowerCase();

  if (provider === "azure") {
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT } = process.env;
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT || !AZURE_OPENAI_EMBEDDING_DEPLOYMENT)
      throw new AIConfigError("Configuração do Azure OpenAI incompleta.");
    const client = new AzureOpenAI({
      endpoint: AZURE_OPENAI_ENDPOINT,
      apiKey: AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
    });
    // No Azure o "model" é o nome do deployment; o modelo por agente é ignorado.
    cached = new OpenAICompatible("azure", client, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT, false);
  } else {
    if (!process.env.OPENAI_API_KEY) throw new AIConfigError("OPENAI_API_KEY não configurada.");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    cached = new OpenAICompatible(
      "openai",
      client,
      process.env.OPENAI_MODEL || "gpt-4o-mini",
      process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      true,
    );
  }
  return cached;
}

export class AIConfigError extends Error {}
