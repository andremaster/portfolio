"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { ActionState } from "./types";
import { FUNCTIONS, type MemberFunction } from "@/lib/functions";

const Invite = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  role: z.enum(["admin", "collaborator", "reader"]),
  is_external: z.string().optional(),
  function: z.enum(FUNCTIONS).default("other"),
});

export async function inviteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.org || !ctx.project || !ctx.canManage) return { error: "Somente administradores do projeto convidam pessoas." };
  const parsed = Invite.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, role } = parsed.data;
  const isExternal = parsed.data.is_external === "on";
  if (isExternal && role === "admin") return { error: "Usuários externos não podem ser administradores." };

  // Permissão já validada acima; o admin client é usado só para localizar/convidar a conta
  const admin = createAdminClient();
  let userId: string | null = null;
  let invited = false;
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${env.appUrl()}/auth/callback?next=/reset-password`,
      data: { invited_to: ctx.org.name },
    });
    if (error || !data.user) return { error: "Não foi possível enviar o convite." };
    userId = data.user.id;
    invited = true;
  }

  await admin.from("organization_members")
    .upsert({ organization_id: ctx.org.id, user_id: userId, role: "member" }, { onConflict: "organization_id,user_id", ignoreDuplicates: true });
  await admin.from("profiles").update({ organization_id: ctx.org.id }).eq("id", userId).is("organization_id", null);

  // Vínculo ao projeto com o cliente do usuário (RLS + auditoria com o autor correto)
  const { error } = await ctx.supabase.from("project_members")
    .upsert({ project_id: ctx.project.id, user_id: userId, role, is_external: isExternal, function: parsed.data.function }, { onConflict: "project_id,user_id" });
  if (error) return { error: "Não foi possível vincular ao projeto." };

  revalidatePath("/team");
  return { ok: invited ? `Convite enviado para ${email}.` : `${email} adicionado ao projeto.` };
}

export async function updateMember(memberId: string, patch: { role?: "admin" | "collaborator" | "reader"; is_external?: boolean; function?: MemberFunction }): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Sem permissão." };
  if (patch.is_external && patch.role === "admin") return { error: "Externos não podem ser administradores." };
  const { data, error } = await ctx.supabase.from("project_members").update(patch).eq("id", memberId).select("id");
  revalidatePath("/team");
  return error || !data?.length ? { error: "Não foi possível alterar." } : { ok: "Permissão atualizada." };
}

export async function removeMember(memberId: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Sem permissão." };
  const { data, error } = await ctx.supabase.from("project_members").delete().eq("id", memberId).select("id");
  revalidatePath("/team");
  return error || !data?.length ? { error: "Não foi possível remover (você não pode remover a si mesmo)." } : { ok: "Acesso removido." };
}
