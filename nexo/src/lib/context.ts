import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberFunction } from "@/lib/functions";

export const ACTIVE_PROJECT_COOKIE = "hub_project";
export const ACTIVE_ORG_COOKIE = "hub_org";

export type ProjectRole = "admin" | "collaborator" | "reader";
export type Project = { id: string; name: string; description: string | null; status: string; environment: string };

/** Contexto do usuário: sessão, organização, projetos e projeto ativo. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, avatar_url, organization_id").eq("id", user.id).single(),
    supabase.from("organization_members").select("role, organization:organizations(id, name, slug, plan)").eq("user_id", user.id),
  ]);

  const orgs = (memberships ?? []).map((m) => ({
    role: m.role as "owner" | "admin" | "member",
    ...(m.organization as unknown as { id: string; name: string; slug: string; plan: string }),
  }));
  // Organização ativa: a escolhida (cookie) > a do perfil > a primeira. Terceiros podem estar em várias.
  const wantedOrg = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const org = orgs.find((o) => o.id === wantedOrg) ?? orgs.find((o) => o.id === profile?.organization_id) ?? orgs[0] ?? null;

  let projects: Project[] = [];
  if (org) {
    const { data } = await supabase.from("projects")
      .select("id, name, description, status, environment")
      .eq("organization_id", org.id).neq("status", "archived").order("created_at");
    projects = data ?? [];
  }

  const store = await cookies();
  const wanted = store.get(ACTIVE_PROJECT_COOKIE)?.value;
  const project = projects.find((p) => p.id === wanted) ?? projects[0] ?? null;

  let role: ProjectRole | null = null;
  let isExternal = false;
  let myFunction: MemberFunction | null = null;
  if (project) {
    const [{ data: r }, { data: ext }, { data: fn }] = await Promise.all([
      supabase.rpc("project_role_of", { p_project: project.id }),
      supabase.rpc("is_project_external", { p_project: project.id }),
      supabase.rpc("project_function_of", { p_project: project.id }),
    ]);
    role = r as ProjectRole | null;
    isExternal = Boolean(ext);
    myFunction = (fn as MemberFunction | null) ?? null;
  }

  const isOrgAdmin = org?.role === "owner" || org?.role === "admin";
  return {
    supabase, user, profile, org, orgs, projects, project, role, isExternal, isOrgAdmin, myFunction,
    canWrite: role === "admin" || role === "collaborator",
    canManage: role === "admin",
  };
});

/** Exige organização (senão envia ao onboarding). */
export async function requireOrg() {
  const ctx = await getContext();
  if (!ctx.org) redirect("/onboarding");
  return ctx as typeof ctx & { org: NonNullable<typeof ctx.org> };
}
