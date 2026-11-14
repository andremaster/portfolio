"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import type { ActionState } from "./types";

const FIELDS = ["objective", "scope", "business_rules", "restrictions", "success_criteria", "stakeholders", "glossary"] as const;

export async function saveBrief(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project || !ctx.canManage) return { error: "Somente administradores do projeto editam a ficha." };
  const row: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = String(form.get(f) ?? "").trim();
    if (v.length > 20000) return { error: "Campo muito longo (máx. 20.000 caracteres)." };
    row[f] = v || null;
  }
  const { error } = await ctx.supabase.from("project_briefs")
    .upsert({ ...row, project_id: ctx.project.id, updated_by: ctx.user.id }, { onConflict: "project_id" });
  revalidatePath("/brief");
  revalidatePath("/dashboard");
  return error ? { error: "Não foi possível salvar a ficha." } : { ok: "Ficha salva. Todos os agentes já usam o novo contexto." };
}
