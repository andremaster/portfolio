"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAI, AIConfigError, AIProviderError } from "@/services/ai/provider";
import { presetById } from "@/services/ai/presets";
import { checkAIUrl, keyHint } from "@/lib/ai-url";
import type { ActionState } from "./types";

const Conn = z.object({
  label: z.string().trim().max(60).optional(),
  provider: z.string().min(1).max(40),
  base_url: z.string().trim().url("Endereço da API inválido.").max(300),
  chat_model: z.string().trim().min(1, "Informe o modelo.").max(120),
  api_key: z.string().trim().max(500).optional(),
});

/** Conecta uma IA pessoal (chave de API ou IA própria). Testa antes de salvar. */
export async function addUserConnection(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  const parsed = Conn.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;
  const urlErr = checkAIUrl(f.base_url);
  if (urlErr) return { error: urlErr };
  if (!f.api_key && f.provider !== "custom") return { error: "Cole a chave de API." };

  const ai = buildAI({ chat: { provider: f.provider, baseURL: f.base_url, model: f.chat_model, apiKey: f.api_key ?? "" }, embed: null }, false);
  try {
    const r = await ai.chat([{ role: "user", content: "Responda apenas: ok" }], { temperature: 0 });
    if (!r.content) return { error: "A IA respondeu vazio. Confira o modelo." };
  } catch (e) {
    return { error: e instanceof AIProviderError || e instanceof AIConfigError ? e.message : "Não foi possível falar com a IA." };
  }

  const admin = createAdminClient();
  const label = f.label || `${presetById(f.provider).name} · ${f.chat_model}`;
  const { data: row, error } = await admin.from("user_ai_connections")
    .insert({ user_id: user.id, label, provider: f.provider, base_url: f.base_url, chat_model: f.chat_model, key_hint: f.api_key ? keyHint(f.api_key) : null })
    .select("id").single();
  if (error || !row) return { error: "Não foi possível salvar a conexão." };
  if (f.api_key) {
    const { data: sid, error: vErr } = await admin.rpc("ai_put_secret", { p_name: `nexo-user-ai-${row.id}`, p_secret: f.api_key });
    if (vErr) { await admin.from("user_ai_connections").delete().eq("id", row.id); return { error: "Não foi possível guardar a chave." }; }
    await admin.from("user_ai_connections").update({ secret_id: sid }).eq("id", row.id);
  }
  revalidatePath("/minhas-ias");
  return { ok: `“${label}” conectada e testada.` };
}

export async function deleteUserConnection(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_ai_connections").delete().eq("id", id).select("id");
  revalidatePath("/minhas-ias");
  return error || !data?.length ? { error: "Não foi possível remover." } : { ok: "Conexão removida." };
}

/** Escolhe qual IA o usuário usa no projeto ativo (null = IA da empresa dona). */
export async function setProjectAI(connectionId: string | null): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project) return { error: "Selecione um projeto." };
  const { error } = await ctx.supabase.from("project_member_ai").upsert(
    { project_id: ctx.project.id, user_id: ctx.user.id, connection_id: connectionId, updated_at: new Date().toISOString() },
    { onConflict: "project_id,user_id" });
  revalidatePath("/minhas-ias");
  return error ? { error: "Não foi possível salvar a escolha." } : { ok: "IA do projeto atualizada." };
}

/** Gera o endereço pessoal do conector MCP. O token só é mostrado uma vez (guardamos o hash). */
export async function createMcpToken(label: string): Promise<{ url?: string; base?: string; key?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  const { randomBytes, createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("mcp_tokens").insert({
    user_id: user.id, token_hash: createHash("sha256").update(token).digest("hex"), label: label.trim().slice(0, 60) || "Conector",
  });
  if (error) return { error: "Não foi possível gerar o conector." };
  revalidatePath("/minhas-ias");
  const { env } = await import("@/lib/env");
  return { url: `${env.appUrl()}/api/mcp/${token}`, base: `${env.appUrl()}/api/mcp`, key: token };
}

export async function revokeMcpToken(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mcp_tokens").update({ revoked: true }).eq("id", id).select("id");
  revalidatePath("/minhas-ias");
  return error || !data?.length ? { error: "Não foi possível revogar." } : { ok: "Conector revogado." };
}
