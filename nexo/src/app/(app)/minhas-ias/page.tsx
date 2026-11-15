import { requireOrg } from "@/lib/context";
import { billingLabel, type BillingMode } from "@/services/ai/billing";
import { AddConnection, ConnectionList, ProjectAIChoice } from "./client";
import { ConnectorPanel } from "./connector";

export const metadata = { title: "Minhas IAs" };
export const maxDuration = 60;

export default async function MyAIs({ searchParams }: { searchParams: Promise<{ bemvindo?: string; ok?: string; erro?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const [{ data: conns }, settings, choice, { data: tokens }] = await Promise.all([
    ctx.supabase.from("user_ai_connections").select("id, label, provider, chat_model, key_hint, created_at").eq("user_id", ctx.user.id).order("created_at"),
    ctx.project ? ctx.supabase.from("project_ai_settings").select("billing_mode, monthly_limit_member, monthly_limit_external").eq("project_id", ctx.project.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.project ? ctx.supabase.from("project_member_ai").select("connection_id").eq("project_id", ctx.project.id).eq("user_id", ctx.user.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("mcp_tokens").select("id, label, last_used_at, created_at").eq("user_id", ctx.user.id).eq("revoked", false).order("created_at", { ascending: false }),
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

      {sp.ok === "openrouter" && <div className="alert alert-ok">OpenRouter conectado com a sua conta. Ele já aparece em Conexões.</div>}
      {sp.erro === "openrouter" && <div className="alert alert-error">Não foi possível conectar o OpenRouter. Tente de novo.</div>}

      <section className="card">
        <div className="card-head"><h2>Entrar com a conta</h2></div>
        <p className="muted small">Conecte sem copiar chave: você entra na conta da empresa de IA e autoriza o Nexo.</p>
        <div className="provider-grid" style={{ marginTop: 12 }}>
          <a className="provider" href="/api/openrouter/start"><b>Entrar com OpenRouter</b><small>ChatGPT, Claude, Gemini, Llama… com uma conta</small></a>
          <span className="provider" style={{ opacity: .55, cursor: "default" }}><b>Entrar com Google</b><small>Gemini · em configuração</small></span>
          <span className="provider" style={{ opacity: .55, cursor: "default" }}><b>Entrar com Microsoft</b><small>Azure OpenAI · em configuração</small></span>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Conector Nexo para ChatGPT, Claude e Gemini</h2><span className="badge mono">MCP</span></div>
        <ConnectorPanel tokens={tokens ?? []} />
      </section>

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
