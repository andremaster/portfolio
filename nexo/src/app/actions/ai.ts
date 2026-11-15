"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAI, loadOrgAISettings, AIConfigError, AIProviderError } from "@/services/ai/provider";
import { presetById } from "@/services/ai/presets";
import { indexSource } from "@/services/rag/indexer";
import type { ActionState } from "./types";

const Url = z.string().trim().url("Endereço da API inválido.").max(300);
const Form = z.object({
  chat_provider: z.string().min(1).max(40),
  chat_base_url: Url,
  chat_model: z.string().trim().min(1, "Informe o modelo de chat.").max(120),
  chat_key: z.string().trim().max(500).optional(),
  embed_mode: z.enum(["same", "separate"]).default("same"),
  embed_provider: z.string().max(40).optional(),
  embed_base_url: z.string().trim().max(300).optional(),
  embed_model: z.string().trim().max(120).optional(),
  embed_key: z.string().trim().max(500).optional(),
});

/** Bloqueia endereços internos (rede da VPS, localhost, IPs privados) — evita acesso à infraestrutura. */
function checkUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "Endereço da API inválido."; }
  if (process.env.ALLOW_PRIVATE_AI_URLS === "true") return null;
  if (u.protocol !== "https:") return "Use um endereço https:// do provedor.";
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return "Endereço interno não é permitido.";
  if (/^(\d+\.){3}\d+$/.test(h) || h.includes(":")) return "Use o domínio do provedor, não um IP.";
  return null;
}

const hint = (key: string) => (key.length >= 8 ? `…${key.slice(-4)}` : "…");

export async function saveAISettings(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.org || !ctx.isOrgAdmin) return { error: "Somente administradores da organização configuram a IA." };
  const parsed = Form.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  const chatUrlErr = checkUrl(f.chat_base_url);
  if (chatUrlErr) return { error: chatUrlErr };

  const admin = createAdminClient();
  const { data: current } = await admin.from("org_ai_settings").select("*").eq("organization_id", ctx.org.id).maybeSingle();
  const stored = current ? await loadOrgAISettings(ctx.org.id) : null;

  const chatKey = f.chat_key || (stored && stored.chat.provider === f.chat_provider ? stored.chat.apiKey : "");
  if (!chatKey && f.chat_provider !== "custom") return { error: "Cole a chave de API do provedor." };

  let embed: { provider: string; baseURL: string; model: string; apiKey: string } | null = null;
  if (f.embed_mode === "same") {
    const model = presetById(f.chat_provider).embedModel ?? (f.chat_provider === "custom" ? f.embed_model : null);
    if (model) embed = { provider: f.chat_provider, baseURL: f.chat_base_url, model, apiKey: chatKey };
  } else {
    if (!f.embed_base_url || !f.embed_model) return { error: "Informe o endereço e o modelo de embeddings." };
    const embUrlErr = checkUrl(f.embed_base_url);
    if (embUrlErr) return { error: embUrlErr };
    const prevEmbed = current?.embed_mode === "separate" && stored?.embed ? stored.embed.apiKey : "";
    const embKey = f.embed_key || (current?.embed_provider === f.embed_provider ? prevEmbed : "");
    if (!embKey && f.embed_provider !== "custom") return { error: "Cole a chave de API de embeddings." };
    embed = { provider: f.embed_provider || "custom", baseURL: f.embed_base_url, model: f.embed_model, apiKey: embKey };
  }
  if (!embed) return { error: "Este provedor não gera embeddings. Em “Busca nos documentos”, escolha “Outro provedor” (ex.: Gemini, que tem plano gratuito)." };

  // Testa antes de salvar: nada é gravado se a IA não responder.
  const ai = buildAI({ chat: { provider: f.chat_provider, baseURL: f.chat_base_url, model: f.chat_model, apiKey: chatKey }, embed });
  try {
    const r = await ai.chat([{ role: "user", content: "Responda apenas: ok" }], { temperature: 0 });
    if (!r.content) return { error: "A IA respondeu vazio. Confira o modelo de chat." };
    await ai.embed(["teste de conexão Nexo"]);
  } catch (e) {
    return { error: e instanceof AIProviderError || e instanceof AIConfigError ? e.message : "Não foi possível falar com a IA." };
  }

  const put = async (name: string, secret: string) => {
    if (!secret) return null;
    const { data, error } = await admin.rpc("ai_put_secret", { p_name: name, p_secret: secret });
    if (error) throw new Error(error.message);
    return data as string;
  };
  try {
    const chatSecret = f.chat_key ? await put(`nexo-ai-${ctx.org.id}-chat`, f.chat_key) : (current?.chat_secret_id ?? null);
    const embedSecret = f.embed_mode === "separate"
      ? (f.embed_key ? await put(`nexo-ai-${ctx.org.id}-embed`, f.embed_key) : (current?.embed_secret_id ?? null))
      : null;
    const row = {
      organization_id: ctx.org.id,
      chat_provider: f.chat_provider, chat_base_url: f.chat_base_url, chat_model: f.chat_model,
      chat_secret_id: chatSecret, chat_key_hint: f.chat_key ? hint(f.chat_key) : (current?.chat_key_hint ?? null),
      embed_mode: f.embed_mode,
      embed_provider: f.embed_mode === "separate" ? embed.provider : null,
      embed_base_url: f.embed_mode === "separate" ? embed.baseURL : null,
      embed_model: embed.model,
      embed_secret_id: embedSecret,
      embed_key_hint: f.embed_mode === "separate" ? (f.embed_key ? hint(f.embed_key) : (current?.embed_key_hint ?? null)) : null,
      updated_by: ctx.user.id,
    };
    const { error } = await admin.from("org_ai_settings").upsert(row, { onConflict: "organization_id" });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[saveAISettings]", e);
    return { error: "Conexão testada, mas não foi possível salvar. Tente novamente." };
  }

  await admin.from("audit_logs").insert({
    organization_id: ctx.org.id, user_id: ctx.user.id, action: "update", entity_type: "ai_settings",
    metadata: { chat_provider: f.chat_provider, chat_model: f.chat_model, embed: ai.embedSignature },
  });

  revalidatePath("/ai");
  const changedEmbeddings = current?.embed_signature && current.embed_signature !== ai.embedSignature;
  return { ok: changedEmbeddings
    ? "IA conectada e testada. O modelo de busca mudou: reindexe as fontes em “Base de conhecimento” → “Reindexar tudo”."
    : "IA conectada e testada. Todas as respostas e indexações agora usam a IA da sua empresa." };
}

export async function removeAISettings(): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.org || !ctx.isOrgAdmin) return { error: "Sem permissão." };
  const admin = createAdminClient();
  const { error } = await admin.from("org_ai_settings").delete().eq("organization_id", ctx.org.id);
  revalidatePath("/ai");
  return error ? { error: "Não foi possível remover." } : { ok: "IA desconectada." };
}

/** Reindexa as fontes do projeto ativo (até 25 por vez, para caber no tempo da requisição). */
export async function reindexProject(): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project || !ctx.canWrite) return { error: "Sem permissão." };
  const { data: sources } = await ctx.supabase.from("knowledge_sources").select("id")
    .eq("project_id", ctx.project.id).order("updated_at", { ascending: true }).limit(25);
  let ok = 0, fail = 0;
  for (const s of sources ?? []) {
    const r = await indexSource(ctx.supabase, s.id);
    if (r.ok) ok++; else fail++;
  }
  revalidatePath("/knowledge");
  return fail ? { error: `${ok} reindexadas, ${fail} com erro. Veja os detalhes na lista.` } : { ok: `${ok} fontes reindexadas.` };
}
