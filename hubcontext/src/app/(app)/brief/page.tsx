import { requireOrg } from "@/lib/context";
import { NoProject } from "@/components/empty";
import { timeAgo } from "@/lib/format";
import { functionLabel } from "@/lib/functions";
import { BriefEditor } from "./client";

export const metadata = { title: "Ficha do projeto" };

const BRIEF_SECTIONS = [
  ["objective", "Objetivo", "Para que o projeto existe e qual resultado se espera."],
  ["scope", "Escopo", "O que está dentro e fora do projeto."],
  ["business_rules", "Regras de negócio", "Regras que toda solução precisa respeitar."],
  ["restrictions", "Restrições", "Exigências do jurídico, compliance, risco e segurança."],
  ["success_criteria", "Critérios de sucesso", "Como saberemos que deu certo."],
  ["stakeholders", "Áreas e responsáveis", "Quem participa e quem decide."],
  ["glossary", "Glossário", "Termos do negócio e seus significados."],
] as const;

export default async function Brief() {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const { data: brief } = await ctx.supabase.from("project_briefs").select("*").eq("project_id", ctx.project.id).maybeSingle();
  const filled = BRIEF_SECTIONS.filter(([k]) => (brief as Record<string, string | null> | null)?.[k]?.trim()).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ficha do projeto</h1>
          <p className="muted">O contexto-base que todos os agentes usam em todas as respostas, para todas as áreas e parceiros.</p>
        </div>
        {ctx.canManage && <BriefEditor brief={brief} />}
      </div>

      <div className="row row-wrap">
        <span className={`badge ${filled === BRIEF_SECTIONS.length ? "badge-ok" : "badge-warn"}`}>{filled}/{BRIEF_SECTIONS.length} seções preenchidas</span>
        {ctx.myFunction && <span className="badge badge-primary">Você vê como: {functionLabel[ctx.myFunction]}</span>}
        {brief?.updated_at && <span className="small muted">Atualizada {timeAgo(brief.updated_at)}</span>}
      </div>

      <div className="brief-grid">
        {BRIEF_SECTIONS.map(([k, title, hint]) => {
          const value = (brief as Record<string, string | null> | null)?.[k];
          return (
            <section className="card" key={k} style={k === "objective" ? { gridColumn: "1 / -1", borderColor: "var(--primary)" } : undefined}>
              <h2 style={{ marginBottom: 6 }}>{title}</h2>
              {value?.trim()
                ? <p style={{ whiteSpace: "pre-wrap" }}>{value}</p>
                : <p className="muted small">{hint}{ctx.canManage ? " Ainda não preenchido." : ""}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
