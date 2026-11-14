"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import type { ActionState } from "./types";

const AgentInput = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80),
  description: z.string().trim().max(500).optional(),
  system_prompt: z.string().trim().min(20, "Descreva melhor o comportamento do agente (mín. 20 caracteres).").max(8000),
  knowledge_scope: z.string().optional(),
  model: z.string().trim().max(80).optional(),
  temperature: z.coerce.number().min(0).max(1.5).default(0.2),
  allow_external: z.string().optional(),
});

export async function saveAgent(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.project || !ctx.canManage) return { error: "Somente administradores do projeto gerenciam agentes." };
  const parsed = AgentInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const row = {
    name: d.name, description: d.description || null, system_prompt: d.system_prompt,
    knowledge_scope: (d.knowledge_scope ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    model: d.model || null, temperature: d.temperature, allow_external: d.allow_external === "on",
  };
  const id = String(form.get("id") ?? "");
  const { error } = id
    ? await ctx.supabase.from("agents").update(row).eq("id", id).eq("project_id", ctx.project.id)
    : await ctx.supabase.from("agents").insert({ ...row, project_id: ctx.project.id, created_by: ctx.user.id });
  if (error) return { error: "Não foi possível salvar o agente." };
  revalidatePath("/agents");
  return { ok: id ? "Agente atualizado." : "Agente criado." };
}

export async function toggleAgent(id: string, active: boolean): Promise<ActionState> {
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from("agents").update({ is_active: active }).eq("id", id).select("id");
  revalidatePath("/agents");
  return error || !data?.length ? { error: "Sem permissão." } : { ok: active ? "Agente ativado." : "Agente desativado." };
}

export async function deleteConversation(id: string): Promise<ActionState> {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("conversations").delete().eq("id", id);
  revalidatePath("/chat");
  return error ? { error: "Não foi possível excluir." } : { ok: "Conversa excluída." };
}
