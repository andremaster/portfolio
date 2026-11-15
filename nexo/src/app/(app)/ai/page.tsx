import { requireOrg } from "@/lib/context";
import { presetById } from "@/services/ai/presets";
import { AIForm, BillingForm } from "./client";

export const metadata = { title: "IA da empresa" };
export const maxDuration = 60;

export default async function AISettingsPage() {
  const ctx = await requireOrg();
  const { data } = await ctx.supabase.from("org_ai_settings")
    .select("chat_provider, chat_base_url, chat_model, chat_key_hint, embed_mode, embed_provider, embed_base_url, embed_model, embed_key_hint, updated_at")
    .eq("organization_id", ctx.org.id).maybeSingle();

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Traga a sua IA</span>
          <h1>IA da empresa</h1>
          <p className="muted">Conecte a IA que a sua empresa já usa. As perguntas e a indexação usam a <b>sua</b> chave: o custo fica com a sua conta no provedor, e a chave é guardada criptografada.</p>
        </div>
        {data && <span className="badge badge-ok"><span className="dot" />Conectada · {presetById(data.chat_provider).name}</span>}
      </div>

      <div className="ai-layout">
        <section className="card glass">
          {ctx.isOrgAdmin ? <AIForm current={data} /> : (
            <div className="empty">
              <h3>Somente administradores</h3>
              <p>Peça a um administrador da organização para conectar a IA.</p>
              {data && <p className="small">Em uso: {presetById(data.chat_provider).name} · {data.chat_model}</p>}
            </div>
          )}
        </section>

        <aside className="card ai-help">
          <h3>Como funciona</h3>
          <ol className="steps">
            <li><b>Chat</b> — responde as perguntas usando os trechos dos documentos. Pode ser Gemini, ChatGPT, Claude, DeepSeek, Kimi, Groq ou qualquer API compatível.</li>
            <li><b>Busca nos documentos (embeddings)</b> — transforma os documentos em vetores. Gemini e OpenAI fazem isso; Claude, DeepSeek e Kimi não, então use um segundo provedor só para isso.</li>
            <li><b>Teste automático</b> — ao salvar, o Nexo faz uma pergunta e uma busca de teste. Nada é gravado se falhar.</li>
          </ol>
          <div className="tip">
            <b>Sem custo para começar:</b> o Google Gemini tem plano gratuito. Crie a chave em aistudio.google.com e use para chat e busca.
          </div>
          <p className="small muted">Trocar o modelo de busca exige reindexar as fontes (botão “Reindexar tudo” na Base de conhecimento).</p>
        </aside>
      </div>

      {ctx.project && ctx.canManage && <ProjectBilling projectId={ctx.project.id} projectName={ctx.project.name} />}
    </>
  );
}

type Usage = { user_id: string; full_name: string | null; email: string | null; company: string | null; job_title: string | null; is_external: boolean; questions_owner: number; questions_member: number; tokens_in: number; tokens_out: number };

async function ProjectBilling({ projectId, projectName }: { projectId: string; projectName: string }) {
  const ctx = await requireOrg();
  const [{ data: settings }, { data: usage }] = await Promise.all([
    ctx.supabase.from("project_ai_settings").select("billing_mode, monthly_limit_member, monthly_limit_external").eq("project_id", projectId).maybeSingle(),
    ctx.supabase.rpc("project_ai_usage", { p_project: projectId }),
  ]);
  const rows = (usage ?? []) as Usage[];
  const total = rows.reduce((a, r) => ({ q: a.q + r.questions_owner, i: a.i + Number(r.tokens_in), o: a.o + Number(r.tokens_out) }), { q: 0, i: 0, o: 0 });
  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div><span className="eyebrow">Projeto {projectName}</span><h2>Quem paga os tokens</h2></div>
        </div>
        <BillingForm current={{ mode: (settings?.billing_mode as "owner" | "member" | "mixed") ?? "owner", member: settings?.monthly_limit_member ?? null, external: settings?.monthly_limit_external ?? null }} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Consumo neste mês</h2>
          <span className="badge mono">{fmt(total.q)} perguntas pagas pela empresa · {fmt(total.i + total.o)} tokens</span>
        </div>
        {rows.length === 0 ? <p className="muted small">Nenhuma pergunta neste mês.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pessoa</th><th className="hide-sm">Empresa · cargo</th><th>Pagas pela empresa</th><th>Com a própria IA</th><th className="hide-sm">Tokens (empresa)</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td><b>{r.full_name ?? r.email}</b>{r.is_external && <span className="badge badge-warn" style={{ marginLeft: 6 }}>Terceiro</span>}</td>
                    <td className="hide-sm muted">{[r.company, r.job_title].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="mono">{fmt(r.questions_owner)}</td>
                    <td className="mono">{fmt(r.questions_member)}</td>
                    <td className="hide-sm mono">{fmt(Number(r.tokens_in) + Number(r.tokens_out))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>O custo em reais depende do provedor e do modelo: confira a fatura na conta da IA conectada pela empresa.</p>
      </section>
    </>
  );
}
