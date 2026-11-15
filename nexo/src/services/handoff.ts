import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexSource } from "@/services/rag/indexer";
import { parseHandoff } from "@/lib/handoff";

export type DraftInput = {
  projectId: string; authorId: string; title: string; contentMd: string; transcript?: string | null;
  source: "mcp" | "ui" | "import"; origin?: string | null; fillBrief?: boolean; baseVersionId?: string | null;
};

/** Grava um rascunho de handoff. `client` = cliente do usuário (RLS) ou admin (permissão já validada). */
export async function createDraft(client: SupabaseClient, d: DraftInput) {
  const { data, error } = await client.from("handoff_versions").insert({
    project_id: d.projectId, author_user_id: d.authorId, title: d.title.slice(0, 150) || "Handoff",
    content_md: d.contentMd.slice(0, 200_000), transcript: d.transcript ? d.transcript.slice(0, 400_000) : null,
    source: d.source, origin: d.origin ?? null, fill_brief: Boolean(d.fillBrief), base_version_id: d.baseVersionId ?? null,
    content_hash: "-", version_no: 0, status: "draft",
  }).select("id, version_no").single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível salvar o rascunho.");
  return data as { id: string; version_no: number };
}

/**
 * Aprova um rascunho: vira versão vigente, as anteriores ficam "substituídas", o conteúdo é
 * indexado como fonte e (se pedido) preenche os campos vazios da ficha. Chamar só depois de
 * validar que `approverId` administra o projeto.
 */
export async function approveDraft(versionId: string, approverId: string, opts: { fillBrief?: boolean; note?: string } = {}) {
  const admin = createAdminClient();
  const { data: v } = await admin.from("handoff_versions").select("*").eq("id", versionId).single();
  if (!v) throw new Error("Versão não encontrada.");
  if (v.status !== "draft") throw new Error("Esta versão já foi revisada.");

  const done: string[] = [];
  const save = async (name: string, category: string, body: string) => {
    const { data: src } = await admin.from("knowledge_sources").insert({
      project_id: v.project_id, name, source_type: "text", category, raw_text: body,
      origin: v.origin, created_by: v.author_user_id ?? approverId,
    }).select("id").single();
    if (!src) return "erro ao salvar";
    const r = await indexSource("trusted", src.id);
    return r.ok ? `${r.chunks} trechos` : r.error;
  };
  if (v.content_md?.trim()) done.push(`resumo indexado (${await save(`Handoff v${v.version_no}: ${v.title}`, "handoff", v.content_md)})`);
  if (v.transcript?.trim()) done.push(`conversa indexada (${await save(`Conversa v${v.version_no}: ${v.title}`, "conversas", v.transcript)})`);

  if ((opts.fillBrief ?? v.fill_brief) && v.content_md) {
    const parsed = parseHandoff(v.content_md);
    const { data: brief } = await admin.from("project_briefs").select("*").eq("project_id", v.project_id).maybeSingle();
    const patch: Record<string, string> = {};
    for (const [k, val] of Object.entries(parsed)) if (val && !(brief as Record<string, unknown> | null)?.[k]) patch[k] = val;
    if (Object.keys(patch).length) {
      await admin.from("project_briefs").upsert({ ...patch, project_id: v.project_id, updated_by: approverId }, { onConflict: "project_id" });
      done.push(`ficha: ${Object.keys(patch).length} campo(s)`);
    }
  }

  const now = new Date().toISOString();
  await admin.from("handoff_versions").update({ status: "superseded" }).eq("project_id", v.project_id).eq("status", "approved");
  await admin.from("handoff_versions").update({ status: "approved", reviewed_by: approverId, reviewed_at: now, review_note: opts.note ?? null }).eq("id", versionId);
  await admin.from("projects").update({ current_handoff_id: versionId }).eq("id", v.project_id);
  const { data: p } = await admin.from("projects").select("organization_id").eq("id", v.project_id).single();
  await admin.from("audit_logs").insert({ organization_id: p?.organization_id, project_id: v.project_id, user_id: approverId, action: "approve", entity_type: "handoff_versions", entity_id: versionId, metadata: { version: v.version_no } });
  return { version: v.version_no as number, summary: done.join("; ") };
}

export async function rejectDraft(versionId: string, reviewerId: string, note?: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("handoff_versions")
    .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_note: note ?? null })
    .eq("id", versionId).eq("status", "draft").select("id");
  if (error || !data?.length) throw new Error("Não foi possível rejeitar (talvez já tenha sido revisada).");
}
