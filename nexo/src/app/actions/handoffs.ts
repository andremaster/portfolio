"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { approveDraft, rejectDraft } from "@/services/handoff";
import type { ActionState } from "./types";

const refresh = () => { revalidatePath("/handoff"); revalidatePath("/knowledge"); revalidatePath("/brief"); revalidatePath("/dashboard"); };

async function canReview(versionId: string) {
  const ctx = await getContext();
  const { data: v } = await ctx.supabase.from("handoff_versions").select("project_id").eq("id", versionId).maybeSingle();
  if (!v) return { ctx, ok: false as const };
  const { data: manage } = await ctx.supabase.rpc("can_manage_project", { p_project: v.project_id });
  return { ctx, ok: Boolean(manage) };
}

export async function approveHandoff(versionId: string, fillBrief: boolean, note?: string): Promise<ActionState> {
  const { ctx, ok } = await canReview(versionId);
  if (!ok) return { error: "Somente administradores do projeto aprovam handoffs." };
  try {
    const r = await approveDraft(versionId, ctx.user.id, { fillBrief, note: note?.slice(0, 500) });
    refresh();
    return { ok: `Versão ${r.version} aprovada e em vigor. ${r.summary}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível aprovar." };
  }
}

export async function rejectHandoff(versionId: string, note?: string): Promise<ActionState> {
  const { ctx, ok } = await canReview(versionId);
  if (!ok) return { error: "Somente administradores do projeto revisam handoffs." };
  try {
    await rejectDraft(versionId, ctx.user.id, note?.slice(0, 500));
    refresh();
    return { ok: "Rascunho rejeitado." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível rejeitar." };
  }
}
