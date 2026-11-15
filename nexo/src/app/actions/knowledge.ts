"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { indexSource } from "@/services/rag/indexer";
import type { ActionState } from "./types";
import { FUNCTIONS, type MemberFunction } from "@/lib/functions";
import { parseHandoff } from "@/lib/handoff";

const ORIGINS = ["chatgpt", "claude", "gemini", "copilot", "outra"] as const;
const ORIGIN_LABEL: Record<(typeof ORIGINS)[number], string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", copilot: "Copilot", outra: "outra IA" };

/** Importa o handoff gerado na IA do usuário: vira fonte indexada e (opcional) preenche a ficha. */
export async function importHandoff(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project) return { error: "Selecione um projeto." };
  if (!ctx.canWrite) return { error: "Seu perfil permite apenas consulta." };
  const text = String(form.get("handoff") ?? "").trim();
  if (text.length < 80) return { error: "Cole o handoff completo gerado pela sua IA." };
  if (text.length > 200_000) return { error: "Handoff muito longo (máx. 200 mil caracteres)." };
  const originRaw = String(form.get("origin") ?? "outra");
  const origin = (ORIGINS as readonly string[]).includes(originRaw) ? (originRaw as (typeof ORIGINS)[number]) : "outra";

  const name = `Handoff do ${ORIGIN_LABEL[origin]} — ${new Date().toLocaleDateString("pt-BR")}`;
  const { data: source, error } = await ctx.supabase.from("knowledge_sources").insert({
    project_id: ctx.project.id, name, source_type: "text", category: "handoff",
    raw_text: text, origin, created_by: ctx.user.id,
  }).select("id").single();
  if (error || !source) return { error: "Não foi possível salvar o handoff." };

  let briefMsg = "";
  if (form.get("fill_brief") === "on" && ctx.canManage) {
    const parsed = parseHandoff(text);
    const { data: brief } = await ctx.supabase.from("project_briefs").select("*").eq("project_id", ctx.project.id).maybeSingle();
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (v && !(brief as Record<string, unknown> | null)?.[k]) patch[k] = v;
    if (Object.keys(patch).length) {
      await ctx.supabase.from("project_briefs").upsert({ ...patch, project_id: ctx.project.id, updated_by: ctx.user.id }, { onConflict: "project_id" });
      briefMsg = ` Ficha: ${Object.keys(patch).length} campo(s) preenchido(s).`;
      revalidatePath("/brief");
    }
  }

  const r = await indexSource(ctx.supabase, source.id);
  revalidatePath("/knowledge");
  revalidatePath("/dashboard");
  return r.ok ? { ok: `Handoff importado e indexado em ${r.chunks} trechos.${briefMsg}` } : { error: `Handoff salvo, mas a indexação falhou: ${r.error}` };
}

const TYPES = ["document", "code", "url", "image", "diagram", "decision", "manual", "api_spec", "text"] as const;
const MAX_BYTES = 20 * 1024 * 1024;

const Base = z.object({
  name: z.string().trim().max(200).optional(),
  category: z.string().trim().toLowerCase().min(1).max(60).default("geral"),
  source_type: z.enum(TYPES).default("document"),
  raw_text: z.string().max(200_000).optional(),
  source_url: z.string().trim().url("URL inválida.").optional().or(z.literal("")),
});

export async function addSource(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project) return { error: "Selecione um projeto." };
  if (!ctx.canWrite) return { error: "Seu perfil permite apenas consulta." };

  const parsed = Base.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile && !input.source_url && !input.raw_text?.trim())
    return { error: "Envie um arquivo, informe uma URL ou cole um texto." };
  if (hasFile && file.size > MAX_BYTES) return { error: "Arquivo maior que 20 MB." };

  const name = input.name || (hasFile ? file.name : input.source_url) || "Texto sem título";
  const source_type = input.source_url && !hasFile ? "url" : input.source_type;

  const audiences = form.getAll("audiences").map(String).filter((a): a is MemberFunction => (FUNCTIONS as readonly string[]).includes(a));
  const { data: source, error } = await ctx.supabase.from("knowledge_sources").insert({
    audiences,
    project_id: ctx.project.id, name, source_type, category: input.category,
    source_url: input.source_url || null, raw_text: input.raw_text?.trim() || null,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !source) return { error: "Não foi possível cadastrar a fonte." };

  if (hasFile) {
    const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${ctx.project.id}/${source.id}/${safe}`;
    const { error: upErr } = await ctx.supabase.storage.from("knowledge").upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) {
      await ctx.supabase.from("knowledge_sources").update({ status: "error", error_message: "Falha no upload." }).eq("id", source.id);
      revalidatePath("/knowledge");
      return { error: "Falha ao enviar o arquivo." };
    }
    await ctx.supabase.from("knowledge_sources").update({ storage_path: path }).eq("id", source.id);
  }

  const result = await indexSource(ctx.supabase, source.id);
  revalidatePath("/knowledge");
  revalidatePath("/dashboard");
  return result.ok ? { ok: `“${name}” indexado em ${result.chunks} trechos.` } : { error: `Fonte salva, mas a indexação falhou: ${result.error}` };
}

export async function reprocessSource(id: string): Promise<ActionState> {
  const ctx = await getContext();
  const r = await indexSource(ctx.supabase, id);
  revalidatePath("/knowledge");
  return r.ok ? { ok: `Reindexado em ${r.chunks} trechos.` } : { error: r.error };
}

export async function deleteSource(id: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Somente administradores do projeto podem excluir fontes." };
  const { data: s } = await ctx.supabase.from("knowledge_sources").select("storage_path").eq("id", id).single();
  if (s?.storage_path) await ctx.supabase.storage.from("knowledge").remove([s.storage_path]);
  const { data, error } = await ctx.supabase.from("knowledge_sources").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir." };
  revalidatePath("/knowledge");
  return { ok: "Fonte excluída." };
}

/** URL temporária (5 min) para abrir o arquivo original. */
export async function getSourceFileUrl(id: string): Promise<{ url?: string; error?: string }> {
  const ctx = await getContext();
  const { data: s } = await ctx.supabase.from("knowledge_sources").select("storage_path, source_url").eq("id", id).single();
  if (!s) return { error: "Sem acesso." };
  if (!s.storage_path) return s.source_url ? { url: s.source_url } : { error: "Fonte sem arquivo." };
  const { data, error } = await ctx.supabase.storage.from("knowledge").createSignedUrl(s.storage_path, 300);
  return error || !data ? { error: "Não foi possível gerar o link." } : { url: data.signedUrl };
}

/** Libera ou revoga uma fonte para um membro externo. */
export async function setSourceGrant(sourceId: string, userId: string, granted: boolean): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Sem permissão." };
  const q = granted
    ? ctx.supabase.from("source_access").upsert({ source_id: sourceId, user_id: userId, granted_by: ctx.user.id })
    : ctx.supabase.from("source_access").delete().eq("source_id", sourceId).eq("user_id", userId);
  const { error } = await q;
  revalidatePath("/team");
  return error ? { error: "Não foi possível alterar o acesso." } : { ok: "Acesso atualizado." };
}
