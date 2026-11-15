"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import type { ActionState } from "./types";

const limit = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : NaN;
};

/** Define quem paga os tokens neste projeto e os limites mensais. */
export async function saveProjectBilling(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project || !ctx.canManage) return { error: "Somente administradores do projeto definem a cobrança." };
  const mode = String(form.get("billing_mode"));
  if (!["owner", "member", "mixed"].includes(mode)) return { error: "Escolha quem paga." };
  const member = limit(form.get("monthly_limit_member"));
  const external = limit(form.get("monthly_limit_external"));
  if (Number.isNaN(member) || Number.isNaN(external)) return { error: "Limite inválido (use um número inteiro ou deixe vazio)." };
  const { error } = await ctx.supabase.from("project_ai_settings").upsert({
    project_id: ctx.project.id, billing_mode: mode, monthly_limit_member: member, monthly_limit_external: external,
    updated_by: ctx.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "project_id" });
  revalidatePath("/ai");
  return error ? { error: "Não foi possível salvar." } : { ok: "Regra de cobrança salva." };
}
