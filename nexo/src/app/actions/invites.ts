"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, ACTIVE_ORG_COOKIE, ACTIVE_PROJECT_COOKIE } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FUNCTIONS, type MemberFunction } from "@/lib/functions";
import type { ActionState } from "./types";

const NewInvite = z.object({
  label: z.string().trim().max(80).optional(),
  role: z.enum(["collaborator", "reader"]),
  days: z.coerce.number().int().min(1).max(90).default(7),
  max_uses: z.string().trim().optional(),
});

export async function createInvite(_: ActionState, form: FormData): Promise<ActionState & { link?: string }> {
  const ctx = await getContext();
  if (!ctx.project || !ctx.canManage) return { error: "Somente administradores do projeto criam convites." };
  const parsed = NewInvite.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const maxUses = parsed.data.max_uses ? Number(parsed.data.max_uses) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500)) return { error: "Número de usos inválido." };
  const allowed = form.getAll("allowed_functions").map(String).filter((f): f is MemberFunction => (FUNCTIONS as readonly string[]).includes(f));

  const { data, error } = await ctx.supabase.from("project_invites").insert({
    project_id: ctx.project.id, label: parsed.data.label || null, role: parsed.data.role,
    is_external: form.get("is_external") === "on", allowed_functions: allowed,
    requires_approval: form.get("requires_approval") === "on", max_uses: maxUses,
    expires_at: new Date(Date.now() + parsed.data.days * 86_400_000).toISOString(), created_by: ctx.user.id,
  }).select("code").single();
  if (error || !data) return { error: "Não foi possível criar o convite." };
  revalidatePath("/team");
  return { ok: "Link criado. Copie e envie para a pessoa ou empresa parceira.", link: `/convite/${data.code}` };
}

export async function revokeInvite(id: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Sem permissão." };
  const { error } = await ctx.supabase.from("project_invites").update({ revoked: true }).eq("id", id);
  revalidatePath("/team");
  return error ? { error: "Não foi possível desativar." } : { ok: "Link desativado." };
}

export async function approveMember(memberId: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canManage) return { error: "Sem permissão." };
  const { data, error } = await ctx.supabase.from("project_members").update({ status: "active" }).eq("id", memberId).select("id");
  revalidatePath("/team");
  return error || !data?.length ? { error: "Não foi possível aprovar." } : { ok: "Acesso aprovado." };
}

/** Lê um convite válido (usado pela página pública do convite). */
export async function getInvite(code: string) {
  if (!/^[a-f0-9]{24}$/.test(code)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("project_invites")
    .select("id, project_id, role, is_external, allowed_functions, requires_approval, max_uses, uses, expires_at, revoked, project:projects(name, organization_id, organization:organizations(name))")
    .eq("code", code).maybeSingle();
  if (!data) return null;
  const project = data.project as unknown as { name: string; organization_id: string; organization: { name: string } };
  const { data: billing } = await admin.from("project_ai_settings").select("billing_mode").eq("project_id", data.project_id).maybeSingle();
  const expired = data.revoked || (data.expires_at && new Date(data.expires_at) < new Date()) || (data.max_uses !== null && data.uses >= data.max_uses);
  return { ...data, project, billingMode: (billing?.billing_mode ?? "owner") as "owner" | "member" | "mixed", expired: Boolean(expired) };
}

const Accept = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(120),
  company: z.string().trim().min(2, "Informe sua empresa.").max(120),
  job_title: z.string().trim().min(2, "Informe seu cargo.").max(120),
  function: z.enum(FUNCTIONS),
});

/** O convidado (já logado) entra no projeto com cargo e área. */
export async function acceptInvite(code: string, _: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Entre ou crie sua conta primeiro." };
  const inv = await getInvite(code);
  if (!inv || inv.expired) return { error: "Este convite expirou ou foi desativado. Peça um novo link ao dono do projeto." };
  const parsed = Accept.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;
  if (inv.allowed_functions.length && !inv.allowed_functions.includes(f.function)) return { error: "Escolha uma das áreas liberadas no convite." };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("project_members").select("id, status").eq("project_id", inv.project_id).eq("user_id", user.id).maybeSingle();
  const status = inv.requires_approval ? "pending" : "active";
  if (!existing) {
    const { count } = await admin.from("project_invites").update({ uses: inv.uses + 1 }, { count: "exact" })
      .eq("id", inv.id).eq("uses", inv.uses); // evita uso duplo do último lugar
    if (!count) return { error: "O convite acabou de ser usado. Tente de novo ou peça outro link." };
  }
  await admin.from("organization_members").upsert(
    { organization_id: inv.project.organization_id, user_id: user.id, role: "member" },
    { onConflict: "organization_id,user_id", ignoreDuplicates: true });
  await admin.from("profiles").update({ full_name: f.full_name }).eq("id", user.id);
  await admin.from("profiles").update({ organization_id: inv.project.organization_id }).eq("id", user.id).is("organization_id", null);
  const { error } = await admin.from("project_members").upsert({
    project_id: inv.project_id, user_id: user.id, role: inv.role, is_external: inv.is_external,
    function: f.function, job_title: f.job_title, company: f.company, status: existing?.status === "active" ? "active" : status,
  }, { onConflict: "project_id,user_id" });
  if (error) return { error: "Não foi possível entrar no projeto." };
  await admin.from("audit_logs").insert({
    organization_id: inv.project.organization_id, project_id: inv.project_id, user_id: user.id, action: "join", entity_type: "project_invites",
    entity_id: inv.id, metadata: { company: f.company, job_title: f.job_title, function: f.function, status },
  });

  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, inv.project.organization_id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 31_536_000 });
  store.set(ACTIVE_PROJECT_COOKIE, inv.project_id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 31_536_000 });
  if (status === "pending" && existing?.status !== "active") return { ok: "Pedido enviado! O dono do projeto precisa aprovar o seu acesso. Você será liberado assim que ele aprovar." };
  redirect(inv.billingMode === "member" ? "/minhas-ias?bemvindo=1" : "/dashboard");
}

/** Troca a organização ativa (quem participa de projetos de mais de uma empresa). */
export async function selectOrg(orgId: string) {
  const ctx = await getContext();
  if (!ctx.orgs.some((o) => o.id === orgId)) return;
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 31_536_000 });
  store.delete(ACTIVE_PROJECT_COOKIE);
}
