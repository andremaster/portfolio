import { requireOrg } from "@/lib/context";
import { envLabel } from "@/lib/format";
import { Empty } from "@/components/empty";
import { ProjectForm, SelectButton } from "./client";

export const metadata = { title: "Projetos" };
export const maxDuration = 60;

export default async function Projects() {
  const ctx = await requireOrg();
  return (
    <>
      <div className="page-head">
        <div><h1>Projetos</h1><p className="muted">Cada projeto tem sua própria base, agentes e equipe — totalmente separados.</p></div>
        {ctx.isOrgAdmin && <ProjectForm />}
      </div>
      {ctx.projects.length === 0
        ? <Empty icon="folder" title="Nenhum projeto" text={ctx.isOrgAdmin ? "Crie o primeiro projeto de IA da sua empresa." : "Você ainda não foi incluído em nenhum projeto."} />
        : (
          <div className="agents-grid">
            {ctx.projects.map((p) => (
              <article className="card agent-card" key={p.id} style={p.id === ctx.project?.id ? { borderColor: "var(--primary)" } : undefined}>
                <header>
                  <div className="type-icon">{p.name[0]}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <h3 className="ellipsis">{p.name}</h3>
                    <div className="tags"><span className="badge">{envLabel[p.environment]}</span>{p.status === "paused" && <span className="badge badge-warn">Pausado</span>}</div>
                  </div>
                </header>
                <p className="muted small">{p.description ?? "Sem descrição."}</p>
                <div className="row">
                  {p.id === ctx.project?.id ? <span className="badge badge-primary">Projeto ativo</span> : <SelectButton id={p.id} />}
                  {p.id === ctx.project?.id && ctx.canManage && <ProjectForm project={p} />}
                </div>
              </article>
            ))}
          </div>
        )}
    </>
  );
}
