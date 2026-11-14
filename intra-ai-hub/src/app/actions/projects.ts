"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PROJECT_COOKIE, getContext } from "@/lib/context";
import { DEFAULT_AGENTS, DEMO_SOURCES } from "@/lib/demo";
import { indexSource } from "@/services/rag/indexer";
import type { ActionState } from "./types";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";

async function setActive(projectId: string) {
  (await cookies()).set(ACTIVE_PROJECT_COOKIE, projectId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function selectProject(projectId: string) {
  await setActive(projectId);
  revalidatePath("/", "layout");
}

/** Onboarding do cliente: organização + projeto demonstrativo com agentes e fontes fictícias. */
export async function createOrganization(_: ActionState, form: FormData): Promise<ActionState> {
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe o nome da empresa." };
  const withDemo = form.get("demo") === "on";
  const supabase = await createClient();
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slug });
  if (error || !orgId) return { error: "Não foi possível criar a organização." };

  const projectId = await createProjectInternal(supabase, orgId as string, withDemo ? "Projeto Atlas (demonstração)" : "Meu primeiro projeto",
    withDemo ? "Projeto fictício para conhecer o Intra AI Hub." : null, withDemo);
  if (projectId) await setActive(projectId);
  redirect("/dashboard");
}

async function createProjectInternal(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, name: string, description: string | null, demo: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: project } = await supabase.from("projects")
    .insert({ organization_id: orgId, name, description, created_by: user!.id })
    .select("id").single();
  if (!project) return null;
  await supabase.from("agents").insert(DEFAULT_AGENTS.map((a) => ({ ...a, project_id: project.id, created_by: user!.id })));
  if (demo) {
    const { data: sources } = await supabase.from("knowledge_sources")
      .insert(DEMO_SOURCES.map((s) => ({ ...s, project_id: project.id, created_by: user!.id })))
      .select("id");
    // Indexa em paralelo; se a IA não estiver configurada as fontes ficam com erro e podem ser reprocessadas
    await Promise.allSettled((sources ?? []).map((s) => indexSource(supabase, s.id)));
  }
  return project.id;
}

const ProjectInput = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120),
  description: z.string().trim().max(1000).optional(),
  environment: z.enum(["development", "staging", "production"]).default("development"),
  status: z.enum(["active", "paused", "archived"]).default("active"),
});

export async function createProject(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.org || !ctx.isOrgAdmin) return { error: "Somente administradores da organização criam projetos." };
  const parsed = ProjectInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = await createProjectInternal(ctx.supabase, ctx.org.id, parsed.data.name, parsed.data.description || null, false);
  if (!id) return { error: "Não foi possível criar o projeto." };
  await ctx.supabase.from("projects").update({ environment: parsed.data.environment }).eq("id", id);
  await setActive(id);
  revalidatePath("/", "layout");
  return { ok: "Projeto criado com os 4 agentes padrão." };
}

export async function updateProject(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const parsed = ProjectInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update({ ...parsed.data, description: parsed.data.description || null }).eq("id", id).select("id");
  if (error || !data?.length) return { error: "Sem permissão para editar este projeto." };
  revalidatePath("/", "layout");
  return { ok: "Projeto atualizado." };
}

export async function addDemoContent(projectId: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.canWrite) return { error: "Sem permissão." };
  const { data: sources } = await ctx.supabase.from("knowledge_sources")
    .insert(DEMO_SOURCES.map((s) => ({ ...s, project_id: projectId, created_by: ctx.user.id })))
    .select("id");
  await Promise.allSettled((sources ?? []).map((s) => indexSource(ctx.supabase, s.id)));
  revalidatePath("/", "layout");
  return { ok: "Conteúdo de demonstração adicionado." };
}

