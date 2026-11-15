import { NextResponse } from "next/server";
import { getContext } from "@/lib/context";
import { HANDOFF_SECTIONS } from "@/lib/handoff";
import { sourceLabel } from "@/components/icons";

export const runtime = "nodejs";

/**
 * Exporta o contexto do projeto ativo em Markdown, para colar no projeto do ChatGPT,
 * Claude ou Gemini do usuário (a conversa lá usa a IA dele, sem custo para a plataforma).
 * Usa o cliente do usuário: só entra o que ele pode ver (RLS).
 */
export async function GET() {
  const ctx = await getContext();
  if (!ctx.project) return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  const p = ctx.project;

  const [{ data: brief }, { data: sources }] = await Promise.all([
    ctx.supabase.from("project_briefs").select("*").eq("project_id", p.id).maybeSingle(),
    ctx.supabase.from("knowledge_sources").select("name, source_type, category, raw_text, status, updated_at")
      .eq("project_id", p.id).order("category").limit(300),
  ]);

  const lines: string[] = [
    `# Contexto do projeto — ${p.name}`,
    "",
    `> Exportado do HubContext em ${new Date().toLocaleString("pt-BR")}. Use como instrução/conhecimento do projeto na sua IA.`,
    "> Responda sempre com base neste contexto; quando algo não estiver aqui, diga que não sabe.",
    "",
  ];
  if (p.description) lines.push(p.description, "");
  for (const [k, title] of HANDOFF_SECTIONS) {
    const v = (brief as Record<string, string | null> | null)?.[k];
    if (v) lines.push(`## ${title}`, v.trim(), "");
  }

  const list = sources ?? [];
  if (list.length) {
    lines.push("## Fontes de conhecimento", "");
    for (const s of list) lines.push(`- **${s.name}** — ${sourceLabel[s.source_type] ?? s.source_type} · ${s.category}`);
    lines.push("");
    const notes = list.filter((s) => s.raw_text && ["decision", "text", "manual"].includes(s.source_type));
    let budget = 60_000;
    for (const s of notes) {
      const t = (s.raw_text ?? "").trim();
      if (!t || budget <= 0) continue;
      const cut = t.slice(0, Math.min(t.length, budget, 12_000));
      budget -= cut.length;
      lines.push(`### ${s.name}`, cut, "");
    }
  }

  await ctx.supabase.from("audit_logs").insert({
    organization_id: ctx.org?.id, project_id: p.id, user_id: ctx.user.id, action: "export", entity_type: "handoff", entity_id: p.id,
  });

  const slug = p.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "projeto";
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="contexto-${slug}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
