import "server-only";
import OpenAI, { AzureOpenAI } from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMBEDDING_DIMENSIONS, presetById } from "./presets";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { content: string; model: string; tokensIn: number; tokensOut: number };

export interface AIProvider {
  readonly name: string;
  readonly embedSignature: string;
  chat(messages: ChatMessage[], opts?: { model?: string | null; temperature?: number }): Promise<ChatResult>;
  embed(texts: string[]): Promise<number[][]>;
}

export { EMBEDDING_DIMENSIONS };

export class AIConfigError extends Error {}
export class AIProviderError extends Error {}

type Endpoint = { provider: string; client: OpenAI; model: string };

/** Ajusta o vetor para 1536 dimensões (modelos Matryoshka aceitam corte + renormalização). */
function fitDimensions(v: number[]): number[] {
  if (v.length === EMBEDDING_DIMENSIONS) return v;
  if (v.length < EMBEDDING_DIMENSIONS)
    throw new AIProviderError(`O modelo de embeddings gera ${v.length} dimensões; o Nexo precisa de pelo menos ${EMBEDDING_DIMENSIONS}. Escolha outro modelo (ex.: gemini-embedding-001 ou text-embedding-3-small).`);
  const cut = v.slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(cut.reduce((s, x) => s + x * x, 0)) || 1;
  return cut.map((x) => x / norm);
}

function describe(e: unknown): string {
  const err = e as { status?: number; message?: string };
  if (err?.status === 401 || err?.status === 403) return "A chave foi recusada pelo provedor (verifique se está correta e ativa).";
  if (err?.status === 404) return "Modelo ou endereço não encontrado no provedor.";
  if (err?.status === 429) return "Limite de uso do provedor atingido (cota ou plano gratuito). Tente mais tarde.";
  return err?.message?.slice(0, 200) ?? "Falha ao chamar a IA.";
}

class OpenAICompatible implements AIProvider {
  constructor(private chatEp: Endpoint, private embedEp: Endpoint | null, private allowModelOverride: boolean) {}

  get name() { return this.chatEp.provider; }
  get embedSignature() { return this.embedEp ? `${this.embedEp.provider}:${this.embedEp.model}` : "none"; }

  async chat(messages: ChatMessage[], opts: { model?: string | null; temperature?: number } = {}) {
    const model = (this.allowModelOverride && opts.model) || this.chatEp.model;
    try {
      const res = await this.chatEp.client.chat.completions.create({ model, messages, temperature: opts.temperature ?? 0.2 });
      return {
        content: res.choices[0]?.message?.content ?? "",
        model: res.model ?? model,
        tokensIn: res.usage?.prompt_tokens ?? 0,
        tokensOut: res.usage?.completion_tokens ?? 0,
      };
    } catch (e) {
      throw new AIProviderError(`Chat (${this.chatEp.provider}): ${describe(e)}`);
    }
  }

  async embed(texts: string[]) {
    if (!this.embedEp) throw new AIConfigError("Nenhum provedor de embeddings configurado. Em “IA da empresa”, conecte Gemini ou OpenAI para a busca nos documentos.");
    const ep = this.embedEp;
    const out: number[][] = [];
    let sendDims = true;
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      let res;
      try {
        res = await ep.client.embeddings.create(
          sendDims ? { model: ep.model, input: batch, dimensions: EMBEDDING_DIMENSIONS } : { model: ep.model, input: batch });
      } catch (e) {
        // alguns provedores não aceitam "dimensions": tenta sem e ajusta localmente
        if (sendDims && (e as { status?: number })?.status === 400) {
          sendDims = false;
          try { res = await ep.client.embeddings.create({ model: ep.model, input: batch }); }
          catch (e2) { throw new AIProviderError(`Embeddings (${ep.provider}): ${describe(e2)}`); }
        } else throw new AIProviderError(`Embeddings (${ep.provider}): ${describe(e)}`);
      }
      out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => fitDimensions(d.embedding)));
    }
    return out;
  }
}

/** Configuração antiga por variável de ambiente (IA da plataforma). Só se PLATFORM_AI_FALLBACK=true. */
function platformAI(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? (process.env.AZURE_OPENAI_ENDPOINT ? "azure" : "openai")).toLowerCase();
  if (provider === "azure") {
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT } = process.env;
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT || !AZURE_OPENAI_EMBEDDING_DEPLOYMENT)
      throw new AIConfigError("Configuração do Azure OpenAI incompleta.");
    const client = new AzureOpenAI({ endpoint: AZURE_OPENAI_ENDPOINT, apiKey: AZURE_OPENAI_API_KEY, apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21" });
    return new OpenAICompatible({ provider: "azure", client, model: AZURE_OPENAI_DEPLOYMENT }, { provider: "azure", client, model: AZURE_OPENAI_EMBEDDING_DEPLOYMENT }, false);
  }
  if (!process.env.OPENAI_API_KEY) throw new AIConfigError("OPENAI_API_KEY não configurada.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined });
  return new OpenAICompatible(
    { provider: "plataforma", client, model: process.env.OPENAI_MODEL || "gpt-4o-mini" },
    { provider: "plataforma", client, model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small" },
    true,
  );
}

export type AISettingsInput = {
  chat: { provider: string; baseURL: string; model: string; apiKey: string };
  embed: { provider: string; baseURL: string; model: string; apiKey: string } | null;
};

/** Monta o provedor a partir de chaves explícitas (usado no teste de conexão). */
export function buildAI(cfg: AISettingsInput, allowModelOverride = true): AIProvider {
  const client = (baseURL: string, apiKey: string) => new OpenAI({ apiKey: apiKey || "sem-chave", baseURL, timeout: 45_000, maxRetries: 1 });
  const chatEp = { provider: cfg.chat.provider, client: client(cfg.chat.baseURL, cfg.chat.apiKey), model: cfg.chat.model };
  const embedEp = cfg.embed ? { provider: cfg.embed.provider, client: client(cfg.embed.baseURL, cfg.embed.apiKey), model: cfg.embed.model } : null;
  return new OpenAICompatible(chatEp, embedEp, allowModelOverride);
}

type SettingsRow = {
  chat_provider: string; chat_base_url: string; chat_model: string; chat_secret_id: string | null;
  embed_mode: "same" | "separate"; embed_provider: string | null; embed_base_url: string | null; embed_model: string | null; embed_secret_id: string | null;
};

/** Carrega a configuração da organização (com as chaves do Vault). Só no servidor. */
export async function loadOrgAISettings(orgId: string): Promise<AISettingsInput | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("org_ai_settings").select("*").eq("organization_id", orgId).maybeSingle();
  const row = data as SettingsRow | null;
  if (!row) return null;
  const secret = async (id: string | null) => {
    if (!id) return "";
    const { data: s } = await admin.rpc("ai_get_secret", { p_id: id });
    return (s as string | null) ?? "";
  };
  const chatKey = await secret(row.chat_secret_id);
  const chat = { provider: row.chat_provider, baseURL: row.chat_base_url, model: row.chat_model, apiKey: chatKey };
  let embed: AISettingsInput["embed"] = null;
  if (row.embed_mode === "same") {
    const p = presetById(row.chat_provider);
    const model = row.embed_model || p.embedModel;
    if (model) embed = { provider: row.chat_provider, baseURL: row.chat_base_url, model, apiKey: chatKey };
  } else if (row.embed_base_url && row.embed_model) {
    embed = { provider: row.embed_provider ?? "custom", baseURL: row.embed_base_url, model: row.embed_model, apiKey: await secret(row.embed_secret_id) };
  }
  return { chat, embed };
}

/** IA da organização. Sem configuração, usa a da plataforma só se PLATFORM_AI_FALLBACK=true. */
export async function getAIForOrg(orgId: string): Promise<AIProvider> {
  const cfg = await loadOrgAISettings(orgId);
  if (cfg) return buildAI(cfg);
  if (process.env.PLATFORM_AI_FALLBACK === "true") return platformAI();
  throw new AIConfigError("A IA da empresa ainda não foi conectada. Um administrador deve configurá-la em “IA da empresa”.");
}

/** Conexão de IA pessoal de um usuário (só chat). Confere o dono da conexão. */
export async function loadUserConnection(connectionId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("user_ai_connections").select("*").eq("id", connectionId).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  let apiKey = "";
  if (data.secret_id) {
    const { data: s } = await admin.rpc("ai_get_secret", { p_id: data.secret_id });
    apiKey = (s as string | null) ?? "";
  }
  return { label: data.label as string, chat: { provider: data.provider as string, baseURL: data.base_url as string, model: data.chat_model as string, apiKey } };
}
