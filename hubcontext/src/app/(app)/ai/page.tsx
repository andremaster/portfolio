import { requireOrg } from "@/lib/context";
import { presetById } from "@/services/ai/presets";
import { AIForm } from "./client";

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
            <li><b>Teste automático</b> — ao salvar, o HubContext faz uma pergunta e uma busca de teste. Nada é gravado se falhar.</li>
          </ol>
          <div className="tip">
            <b>Sem custo para começar:</b> o Google Gemini tem plano gratuito. Crie a chave em aistudio.google.com e use para chat e busca.
          </div>
          <p className="small muted">Trocar o modelo de busca exige reindexar as fontes (botão “Reindexar tudo” na Base de conhecimento).</p>
        </aside>
      </div>
    </>
  );
}
