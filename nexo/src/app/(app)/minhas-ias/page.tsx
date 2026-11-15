import { requireOrg } from "@/lib/context";
import { billingLabel, type BillingMode } from "@/services/ai/billing";
import { AddConnection, ConnectionList, ProjectAIChoice } from "./client";

export const metadata = { title: "Minhas IAs" };
export const maxDuration = 60;

export default async function MyAIs({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const [{ data: conns }, settings, choice] = await Promise.all([
    ctx.supabase.from("user_ai_connections").select("id, label, provider, chat_model, key_hint, created_at").eq("user_id", ctx.user.id).order("created_at"),
    ctx.project ? ctx.supabase.from("project_ai_settings").select("billing_mode, monthly_limit_member, monthly_limit_external").eq("project_id", ctx.project.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.project ? ctx.supabase.from("project_member_ai").select("connection_id").eq("project_id", ctx.project.id).eq("user_id", ctx.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mode = ((settings.data?.billing_mode as BillingMode | undefined) ?? "owner");
  const limit = ctx.isExternal ? settings.data?.monthly_limit_external : settings.data?.monthly_limit_member;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Sua conta</span>
          <h1>Minhas IAs</h1>
          <p className="muted">As IAs que <b>você</b> conectou. Use-as nos projetos em que a empresa dona deixa cada participante pagar com a própria IA.</p>
        </div>
      </div>

      {sp.bemvindo && mode === "member" && (
        <div className="tip">Bem-vindo! Neste projeto cada participante usa a própria IA. Conecte a sua abaixo e escolha-a para o projeto.</div>
      )}

      {ctx.project && (
        <section className="card">
          <div className="card-head"><h2>IA no projeto “{ctx.project.name}”</h2><span className="badge">{billingLabel[mode]}</span></div>
          <ProjectAIChoice mode={mode} current={(choice.data?.connection_id as string | null) ?? null}
            connections={(conns ?? []).map((c) => ({ id: c.id, label: c.label }))} limit={limit ?? null} />
        </section>
      )}

      <div className="ai-layout">
        <section className="card">
          <div className="card-head"><h2>Conexões</h2></div>
          <ConnectionList items={(conns ?? []).map((c) => ({ id: c.id, label: c.label, model: c.chat_model, hint: c.key_hint }))} />
        </section>
        <section className="card">
          <div className="card-head"><h2>Conectar nova IA</h2></div>
          <AddConnection />
        </section>
      </div>
    </>
  );
}
