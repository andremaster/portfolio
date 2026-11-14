import Link from "next/link";
import { requireOrg } from "@/lib/context";
import { Icon, sourceIcon } from "@/components/icons";
import { NoProject } from "@/components/empty";
import { envLabel, timeAgo } from "@/lib/format";

export const metadata = { title: "Dashboard" };

type Stats = { sources: number; indexed: number; errors: number; pending: number; agents: number; members: number; externals: number; chunks: number; categories: number };

const ACTION_LABEL: Record<string, string> = { insert: "criou", update: "alterou", delete: "removeu", query: "consultou", create: "criou" };
const ENTITY_LABEL: Record<string, string> = { knowledge_sources: "fonte", agents: "agente", project_members: "membro", projects: "projeto", source_access: "acesso a fonte", integrations: "integração", agent: "agente", organization: "organização" };

export default async function Dashboard() {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const p = ctx.project;

  const [{ data: stats }, { data: queries }, { data: categories }, { data: activity }] = await Promise.all([
    ctx.supabase.rpc("project_stats", { p_project: p.id }),
    ctx.supabase.rpc("project_query_count", { p_project: p.id, p_days: 30 }),
    ctx.supabase.from("knowledge_sources").select("category, status").eq("project_id", p.id),
    ctx.canManage
      ? ctx.supabase.from("audit_logs").select("id, action, entity_type, metadata, created_at, user_id").eq("project_id", p.id).order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
  ]);
  const s = (stats ?? {}) as Stats;

  const byCat = new Map<string, number>();
  (categories ?? []).forEach((c) => byCat.set(c.category, (byCat.get(c.category) ?? 0) + 1));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...cats.map(([, n]) => n));

  // Saúde: % indexado (60) + cobertura de categorias (25) + ausência de erros (15)
  const health = s.sources === 0 ? 0 : Math.round(
    (s.indexed / s.sources) * 60 + Math.min(s.categories, 5) / 5 * 25 + (s.errors === 0 ? 15 : Math.max(0, 15 - s.errors * 5)));

  const { data: recentSources } = activity ? { data: null } : await ctx.supabase.from("knowledge_sources")
    .select("id, name, source_type, updated_at, status").eq("project_id", p.id).order("updated_at", { ascending: false }).limit(6);

  const cards: [string, number, string][] = [
    ["Fontes de conhecimento", s.sources ?? 0, `${s.indexed ?? 0} indexadas`],
    ["Agentes ativos", s.agents ?? 0, "especializados"],
    ["Membros", s.members ?? 0, `${s.externals ?? 0} externos`],
    ["Consultas (30 dias)", (queries as number) ?? 0, `${s.chunks ?? 0} trechos na base`],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{p.name}</h1>
          <p className="muted">{p.description ?? "Visão geral do conhecimento do projeto."}</p>
        </div>
        <span className="badge badge-primary">{envLabel[p.environment] ?? p.environment}</span>
      </div>

      <section className="stats">
        {cards.map(([label, value, hint]) => (
          <div className="card stat" key={label}><span>{label}</span><b>{value}</b><small className="muted">{hint}</small></div>
        ))}
      </section>

      <div className="row row-wrap">
        <Link href="/chat" className="btn btn-primary"><Icon name="chat" size={16} /> Perguntar a um agente</Link>
        {ctx.canWrite && <Link href="/knowledge?add=1" className="btn"><Icon name="plus" size={16} /> Adicionar conhecimento</Link>}
        {ctx.canManage && <Link href="/team" className="btn"><Icon name="users" size={16} /> Convidar pessoa</Link>}
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Saúde do conhecimento</h2>{s.errors > 0 && <Link href="/knowledge?status=error" className="badge badge-danger">{s.errors} com erro</Link>}</div>
          <div className="health">
            <div className="ring" style={{ ["--v" as string]: health }}><div><div><b>{health}%</b><small className="muted">saúde</small></div></div></div>
            <div style={{ display: "grid", gap: 12 }}>
              {cats.length === 0 && <p className="muted">Nenhuma fonte ainda. Adicione documentos para alimentar os agentes.</p>}
              {cats.map(([c, n]) => (
                <div key={c} style={{ display: "grid", gap: 4 }}>
                  <div className="row small" style={{ justifyContent: "space-between" }}><span style={{ textTransform: "capitalize" }}>{c}</span><span className="muted">{n}</span></div>
                  <div className="bar"><i style={{ width: `${(n / maxCat) * 100}%` }} /></div>
                </div>
              ))}
              {s.pending > 0 && <p className="small muted">{s.pending} fonte(s) aguardando indexação.</p>}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Atividades recentes</h2></div>
          <div className="list">
            {activity?.map((a) => (
              <div className="list-item small" key={a.id}>
                <div className="grow">
                  <b>{ACTION_LABEL[a.action] ?? a.action}</b> {ENTITY_LABEL[a.entity_type] ?? a.entity_type}
                  {(a.metadata as { name?: string })?.name ? <> “{(a.metadata as { name?: string }).name}”</> : null}
                </div>
                <span className="muted">{timeAgo(a.created_at)}</span>
              </div>
            ))}
            {recentSources?.map((r) => (
              <Link className="list-item small" key={r.id} href="/knowledge">
                <Icon name={sourceIcon[r.source_type] ?? "file"} />
                <span className="grow ellipsis">{r.name}</span>
                <span className="muted">{timeAgo(r.updated_at)}</span>
              </Link>
            ))}
            {!activity?.length && !recentSources?.length && <p className="muted small">Sem atividades ainda.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
