import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/context";
import { NoProject } from "@/components/empty";
import { initials, roleLabel, timeAgo } from "@/lib/format";
import { InviteMember, MemberActions, MemberFunctionSelect, MemberRole } from "./client";
import { functionLabel, type MemberFunction } from "@/lib/functions";

export const metadata = { title: "Equipe e acessos" };

export default async function Team() {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  if (ctx.isExternal) redirect("/dashboard");
  const pid = ctx.project.id;

  const [{ data: members }, { data: sources }, { data: grants }, { data: logs }] = await Promise.all([
    ctx.supabase.from("project_members").select("id, user_id, role, is_external, function, created_at").eq("project_id", pid).order("created_at"),
    ctx.supabase.from("knowledge_sources").select("id, name, category").eq("project_id", pid).order("category"),
    ctx.canManage ? ctx.supabase.from("source_access").select("source_id, user_id") : Promise.resolve({ data: [] }),
    ctx.canManage ? ctx.supabase.from("audit_logs").select("id, action, entity_type, metadata, created_at, user_id").eq("project_id", pid)
      .in("entity_type", ["project_members", "source_access", "knowledge_sources", "agents"]).order("created_at", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  const ids = [...new Set([...(members ?? []).map((m) => m.user_id), ...(logs ?? []).map((l) => l.user_id).filter(Boolean)])] as string[];
  const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <>
      <div className="page-head">
        <div><h1>Equipe e acessos</h1><p className="muted">Quem participa de <b>{ctx.project.name}</b> e o que cada pessoa pode ver.</p></div>
        {ctx.canManage && <InviteMember />}
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Pessoa</th><th>Área</th><th>Permissão</th><th className="hide-sm">Tipo</th><th></th></tr></thead>
            <tbody>
              {(members ?? []).map((m) => {
                const p = prof.get(m.user_id);
                const granted = (grants ?? []).filter((g) => g.user_id === m.user_id).map((g) => g.source_id);
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="avatar">{initials(p?.full_name ?? p?.email)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="ellipsis" style={{ fontWeight: 600 }}>{p?.full_name ?? "Convite pendente"}{m.user_id === ctx.user.id && " (você)"}</div>
                          <div className="small muted ellipsis">{p?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{ctx.canManage
                      ? <MemberFunctionSelect id={m.id} fn={m.function as MemberFunction} />
                      : functionLabel[m.function as MemberFunction]}</td>
                    <td>{ctx.canManage && m.user_id !== ctx.user.id
                      ? <MemberRole id={m.id} role={m.role} isExternal={m.is_external} />
                      : roleLabel[m.role]}</td>
                    <td className="hide-sm">{m.is_external
                      ? <span className="badge badge-warn">Externo · {granted.length} fonte(s)</span>
                      : <span className="badge">Interno</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      {ctx.canManage && m.user_id !== ctx.user.id &&
                        <MemberActions id={m.id} userId={m.user_id} name={p?.full_name ?? p?.email ?? ""} isExternal={m.is_external} sources={sources ?? []} granted={granted} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Perfis de acesso</h2></div>
        <div className="grid-2 small">
          <div><b>Administrador</b><p className="muted">Gerencia membros, agentes, fontes e configurações do projeto.</p></div>
          <div><b>Colaborador</b><p className="muted">Consulta os agentes e inclui ou reprocessa conhecimento.</p></div>
          <div><b>Leitor</b><p className="muted">Apenas consulta os agentes e a base.</p></div>
          <div><b>Externo</b><p className="muted">Terceiros: veem só as fontes liberadas individualmente, inclusive nas respostas da IA.</p></div>
        </div>
      </section>

      {ctx.canManage && (
        <section className="card">
          <div className="card-head"><h2>Auditoria</h2></div>
          <div className="list small">
            {(logs ?? []).length === 0 && <p className="muted">Sem registros.</p>}
            {(logs ?? []).map((l) => (
              <div className="list-item" key={l.id}>
                <span className="grow">
                  <b>{prof.get(l.user_id ?? "")?.full_name ?? "Sistema"}</b> · {l.action} · {l.entity_type.replace("_", " ")}
                  {(l.metadata as { name?: string; role?: string })?.name ? ` “${(l.metadata as { name: string }).name}”` : ""}
                  {(l.metadata as { role?: string })?.role ? ` (${roleLabel[(l.metadata as { role: string }).role] ?? ""})` : ""}
                </span>
                <span className="muted">{timeAgo(l.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
