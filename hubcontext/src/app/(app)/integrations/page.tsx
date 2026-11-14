import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/context";
import { INTEGRATIONS } from "@/services/integrations/registry";
import { Icon } from "@/components/icons";

export const metadata = { title: "Integrações" };

export default async function Integrations() {
  const ctx = await requireOrg();
  if (ctx.isExternal) redirect("/dashboard");
  const { data: rows } = ctx.project
    ? await ctx.supabase.from("integrations").select("integration_type, status, last_sync_at").eq("project_id", ctx.project.id)
    : { data: [] };
  const status = new Map((rows ?? []).map((r) => [r.integration_type, r.status]));
  return (
    <>
      <div className="page-head">
        <div><h1>Integrações</h1><p className="muted">Conecte as fontes da empresa para manter a base sempre atualizada.</p></div>
      </div>
      <div className="agents-grid">
        {INTEGRATIONS.map((i) => (
          <article className="card agent-card" key={i.type}>
            <header>
              <div className="type-icon"><Icon name="plug" /></div>
              <div className="grow"><h3>{i.name}</h3>
                <span className={`badge ${status.get(i.type) === "connected" ? "badge-ok" : ""}`}>{status.get(i.type) === "connected" ? "Conectado" : i.available ? "Disponível" : "Em breve"}</span>
              </div>
            </header>
            <p className="muted small">{i.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
