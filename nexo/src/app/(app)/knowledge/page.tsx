import Link from "next/link";
import { requireOrg } from "@/lib/context";
import { Icon, sourceIcon, sourceLabel } from "@/components/icons";
import { Empty, NoProject } from "@/components/empty";
import { timeAgo } from "@/lib/format";
import { AddSource, HandoffImport, ReindexAll, SourceActions } from "./client";
import { handoffPrompt } from "@/lib/handoff";
import { functionLabel, type MemberFunction } from "@/lib/functions";

export const metadata = { title: "Base de conhecimento" };
export const maxDuration = 60;

const STATUS: Record<string, [string, string]> = {
  indexed: ["Indexado", "badge-ok"], processing: ["Processando", "badge-warn"],
  pending: ["Pendente", "badge-warn"], error: ["Erro", "badge-danger"],
};

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; add?: string }> }) {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const sp = await searchParams;

  let query = ctx.supabase.from("knowledge_sources")
    .select("id, name, source_type, category, status, error_message, chunk_count, storage_path, source_url, updated_at, audiences")
    .eq("project_id", ctx.project.id).order("updated_at", { ascending: false }).limit(200);
  if (sp.q) query = query.ilike("name", `%${sp.q.replace(/[%_]/g, "")}%`);
  if (sp.category) query = query.eq("category", sp.category);
  if (sp.status) query = query.eq("status", sp.status as "indexed");
  const [{ data: sources }, { data: allCats }] = await Promise.all([
    query,
    ctx.supabase.from("knowledge_sources").select("category").eq("project_id", ctx.project.id),
  ]);
  const categories = [...new Set((allCats ?? []).map((c) => c.category))].sort();

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, add: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/knowledge${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Base de conhecimento</h1><p className="muted">Documentos, código, APIs, diagramas e decisões que alimentam os agentes.</p></div>
        <div className="row row-wrap">
          <a className="btn btn-ghost" href="/api/handoff" title="Baixa o contexto em Markdown para usar no ChatGPT, Claude ou Gemini"><Icon name="download" size={16} /> Levar para minha IA</a>
          {ctx.canWrite && <ReindexAll />}
          {ctx.canWrite && <HandoffImport prompt={handoffPrompt(ctx.project.name)} canManage={ctx.canManage} />}
          {ctx.canWrite && <AddSource categories={categories} autoOpen={sp.add === "1"} />}
        </div>
      </div>

      {ctx.isExternal && <div className="alert" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>Você está vendo apenas as fontes liberadas para o seu acesso externo.</div>}

      <form className="toolbar" action="/knowledge">
        <div className="row grow" style={{ maxWidth: 420 }}>
          <input className="input" name="q" defaultValue={sp.q} placeholder="Buscar por nome…" aria-label="Buscar fontes" />
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          <button className="btn icon-btn" aria-label="Buscar"><Icon name="search" /></button>
        </div>
        <div className="chips">
          <Link className={`chip ${!sp.category && !sp.status ? "active" : ""}`} href={link({ category: undefined, status: undefined })}>Todas</Link>
          {categories.map((c) => <Link key={c} className={`chip ${sp.category === c ? "active" : ""}`} href={link({ category: c })} style={{ textTransform: "capitalize" }}>{c}</Link>)}
          <Link className={`chip ${sp.status === "error" ? "active" : ""}`} href={link({ status: sp.status === "error" ? undefined : "error" })}>Com erro</Link>
        </div>
      </form>

      {!sources?.length ? (
        <Empty icon="book" title={sp.q || sp.category || sp.status ? "Nada encontrado" : "Base vazia"}
          text={sp.q || sp.category || sp.status ? "Ajuste os filtros da busca." : "Adicione o primeiro documento para que os agentes possam responder."} />
      ) : (
        <section className="card" style={{ padding: "6px 18px" }}>
          <div className="list">
            {sources.map((s) => {
              const [label, cls] = STATUS[s.status] ?? [s.status, ""];
              return (
                <div className="list-item" key={s.id}>
                  <div className="type-icon"><Icon name={sourceIcon[s.source_type] ?? "file"} /></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="small muted row row-wrap" style={{ gap: 6 }}>
                      <span>{sourceLabel[s.source_type]}</span>·<span style={{ textTransform: "capitalize" }}>{s.category}</span>
                      {s.audiences?.length > 0 && <span className="badge badge-warn">só {(s.audiences as MemberFunction[]).map((a) => functionLabel[a]).join(", ")}</span>}
                      <span className="hide-sm">· {s.chunk_count} trechos · {timeAgo(s.updated_at)}</span>
                    </div>
                    {s.status === "error" && s.error_message && <div className="small" style={{ color: "var(--danger)" }}>{s.error_message}</div>}
                  </div>
                  <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                  <SourceActions id={s.id} name={s.name} hasFile={Boolean(s.storage_path || s.source_url)} canWrite={ctx.canWrite} canDelete={ctx.canManage} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
