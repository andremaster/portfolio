import { requireOrg } from "@/lib/context";
import { NoProject } from "@/components/empty";
import { diffLines, diffStats } from "@/lib/diff";
import { timeAgo } from "@/lib/format";
import { ReviewActions, DiffView } from "./client";

export const metadata = { title: "Handoffs" };
export const maxDuration = 60;

const STATUS: Record<string, [string, string]> = {
  draft: ["Rascunho", "badge-warn"], approved: ["Em vigor", "badge-ok"],
  rejected: ["Rejeitado", "badge-danger"], superseded: ["Substituído", ""],
};
const ORIGIN: Record<string, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", copilot: "Copilot", outra: "outra IA" };
const SOURCE: Record<string, string> = { mcp: "conector", ui: "colado no site", import: "exportação" };

type V = { id: string; version_no: number; title: string; content_md: string; transcript: string | null; status: string; source: string; origin: string | null; fill_brief: boolean; author_user_id: string | null; created_at: string; reviewed_at: string | null; review_note: string | null; base_version_id: string | null };

export default async function Handoffs({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const sp = await searchParams;
  const { data: rows } = await ctx.supabase.from("handoff_versions")
    .select("id, version_no, title, content_md, transcript, status, source, origin, fill_brief, author_user_id, created_at, reviewed_at, review_note, base_version_id")
    .eq("project_id", ctx.project.id).order("version_no", { ascending: false }).limit(60);
  const versions = (rows ?? []) as V[];
  const { data: proj } = await ctx.supabase.from("projects").select("current_handoff_id").eq("id", ctx.project.id).single();
  const current = versions.find((v) => v.id === proj?.current_handoff_id) ?? null;
  const ids = [...new Set(versions.map((v) => v.author_user_id).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  const drafts = versions.filter((v) => v.status === "draft");
  const selected = versions.find((v) => v.id === sp.v) ?? drafts[0] ?? current ?? versions[0] ?? null;
  const diff = selected && selected.id !== current?.id ? diffLines(current?.content_md ?? "", selected.content_md) : null;
  const stats = diff ? diffStats(diff) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Contexto oficial do projeto</span>
          <h1>Handoffs</h1>
          <p className="muted">Tudo que chega das IAs da equipe (conector, colar handoff, exportação) entra como <b>rascunho</b>. {ctx.canManage ? "Você revisa o que mudou e aprova: só então vira contexto oficial." : "Um administrador revisa e aprova antes de virar contexto oficial."}</p>
        </div>
        {current && <span className="badge badge-ok"><span className="dot" />Em vigor: v{current.version_no} · {timeAgo(current.reviewed_at ?? current.created_at)}</span>}
      </div>

      {ctx.canManage && drafts.length > 0 && (
        <div className="tip">{drafts.length} rascunho(s) aguardando sua revisão.</div>
      )}

      {versions.length === 0 ? (
        <section className="card empty">
          <h3>Nenhum handoff ainda</h3>
          <p>No seu Claude/ChatGPT com o conector Nexo, peça: “atualize o handoff do projeto {ctx.project.name} no Nexo”. Ou use “Importar de outra IA” na Base de conhecimento.</p>
        </section>
      ) : (
        <div className="ai-layout" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)" }}>
          <section className="card" style={{ padding: "6px 14px" }}>
            <div className="list">
              {versions.map((v) => {
                const [label, cls] = STATUS[v.status] ?? [v.status, ""];
                return (
                  <a key={v.id} href={`/handoff?v=${v.id}`} className="list-item" style={{ background: selected?.id === v.id ? "var(--surface-2)" : undefined, borderRadius: 10, padding: "10px 8px" }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontWeight: 600 }}>v{v.version_no} · {v.title}</div>
                      <div className="small muted">{who.get(v.author_user_id ?? "") ?? "—"} · {SOURCE[v.source] ?? v.source}{v.origin ? ` · ${ORIGIN[v.origin] ?? v.origin}` : ""} · {timeAgo(v.created_at)}</div>
                    </div>
                    <span className={`badge ${cls}`}>{label}</span>
                  </a>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="card" style={{ display: "grid", gap: 14, alignContent: "start" }}>
              <div className="card-head" style={{ marginBottom: 0 }}>
                <div>
                  <h2>v{selected.version_no} · {selected.title}</h2>
                  <p className="small muted">Enviado por {who.get(selected.author_user_id ?? "") ?? "—"} via {SOURCE[selected.source] ?? selected.source}{selected.origin ? ` (${ORIGIN[selected.origin] ?? selected.origin})` : ""} · {new Date(selected.created_at).toLocaleString("pt-BR")}</p>
                  {selected.base_version_id && current && selected.base_version_id !== current.id && selected.status === "draft" && (
                    <p className="small" style={{ color: "var(--warn)" }}>Atenção: este rascunho foi feito sobre uma versão antiga. Compare com cuidado.</p>
                  )}
                  {selected.review_note && <p className="small muted">Nota da revisão: {selected.review_note}</p>}
                </div>
                <span className={`badge ${(STATUS[selected.status] ?? ["", ""])[1]}`}>{(STATUS[selected.status] ?? [selected.status])[0]}</span>
              </div>

              {selected.status === "draft" && ctx.canManage && <ReviewActions id={selected.id} fillBrief={selected.fill_brief} />}

              {diff && selected.content_md ? (
                <>
                  <div className="small muted mono">Comparado com {current ? `a versão em vigor (v${current.version_no})` : "nada (primeira versão)"} · <span style={{ color: "var(--accent)" }}>+{stats!.added}</span> <span style={{ color: "var(--danger)" }}>−{stats!.removed}</span> linhas</div>
                  <DiffView lines={diff} />
                </>
              ) : selected.content_md ? (
                <pre className="subcard small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{selected.content_md}</pre>
              ) : null}

              {selected.transcript && (
                <details className="subcard">
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Conversa completa ({selected.transcript.length.toLocaleString("pt-BR")} caracteres)</summary>
                  <pre className="small" style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto" }}>{selected.transcript.slice(0, 60_000)}</pre>
                </details>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
