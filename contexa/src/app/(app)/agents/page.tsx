import Link from "next/link";
import { requireOrg } from "@/lib/context";
import { Icon } from "@/components/icons";
import { Empty, NoProject } from "@/components/empty";
import { AgentEditor, AgentToggle } from "./client";

export const metadata = { title: "Agentes" };

export default async function Agents() {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const { data: agents } = await ctx.supabase.from("agents")
    .select("id, name, description, system_prompt, knowledge_scope, model, temperature, is_active, allow_external")
    .eq("project_id", ctx.project.id).order("created_at");

  // Total de conversas por agente (somente as do próprio usuário, por privacidade)
  const { data: convs } = await ctx.supabase.from("conversations").select("agent_id").eq("project_id", ctx.project.id);
  const usage = new Map<string, number>();
  (convs ?? []).forEach((c) => c.agent_id && usage.set(c.agent_id, (usage.get(c.agent_id) ?? 0) + 1));

  return (
    <>
      <div className="page-head">
        <div><h1>Agentes</h1><p className="muted">Especialistas do projeto, cada um com prompt, modelo e escopo de conhecimento próprios.</p></div>
        {ctx.canManage && <AgentEditor />}
      </div>
      {!agents?.length ? <Empty icon="bot" title="Nenhum agente" text="Crie um agente para começar a consultar a base." /> : (
        <div className="agents-grid">
          {agents.map((a) => (
            <article className="card agent-card" key={a.id} style={{ opacity: a.is_active ? 1 : .6 }}>
              <header>
                <div className="type-icon"><Icon name="bot" /></div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <h3 className="ellipsis">{a.name}</h3>
                  <span className={`badge ${a.is_active ? "badge-ok" : ""}`}><span className="dot" />{a.is_active ? "Ativo" : "Inativo"}</span>
                </div>
              </header>
              <p className="muted small">{a.description}</p>
              <div className="tags">
                {(a.knowledge_scope?.length ? a.knowledge_scope : ["todas as categorias"]).map((t: string) => <span className="badge" key={t}>{t}</span>)}
                {!a.allow_external && <span className="badge badge-warn">só internos</span>}
              </div>
              <div className="small muted">Temperatura {Number(a.temperature).toFixed(1)}{a.model ? ` · ${a.model}` : ""} · {usage.get(a.id) ?? 0} conversa(s) suas</div>
              <div className="row row-wrap">
                <Link className="btn btn-primary btn-sm" href={`/chat?agent=${a.id}`}><Icon name="chat" size={14} /> Testar</Link>
                {ctx.canManage && <AgentEditor agent={a} />}
                {ctx.canManage && <AgentToggle id={a.id} active={a.is_active} />}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
