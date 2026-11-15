"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeAISettings, saveAISettings } from "@/app/actions/ai";
import { saveProjectBilling } from "@/app/actions/billing";
import { FormMessage, Submit } from "@/components/ui";
import { PRESETS, presetById, type ProviderId } from "@/services/ai/presets";

type Current = {
  chat_provider: string; chat_base_url: string; chat_model: string; chat_key_hint: string | null;
  embed_mode: string; embed_provider: string | null; embed_base_url: string | null; embed_model: string | null; embed_key_hint: string | null;
} | null;

const EMBED_PRESETS = PRESETS.filter((p) => p.embedModel !== null);

export function AIForm({ current }: { current: Current }) {
  const [state, action] = useActionState(saveAISettings, undefined);
  const [provider, setProvider] = useState<ProviderId>((current?.chat_provider as ProviderId) ?? "gemini");
  const preset = presetById(provider);
  const [baseURL, setBaseURL] = useState(current?.chat_base_url ?? preset.baseURL);
  const [model, setModel] = useState(current?.chat_model ?? preset.chatModel);
  const [embedMode, setEmbedMode] = useState<"same" | "separate">(
    (current?.embed_mode as "same" | "separate") ?? (preset.embedModel ? "same" : "separate"));
  const [embProvider, setEmbProvider] = useState<ProviderId>((current?.embed_provider as ProviderId) ?? "gemini");
  const embPreset = presetById(embProvider);
  const [embURL, setEmbURL] = useState(current?.embed_base_url ?? embPreset.baseURL);
  const [embModel, setEmbModel] = useState(current?.embed_model ?? embPreset.embedModel ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sameKeyProvider = current?.chat_provider === provider;

  const pick = (id: ProviderId) => {
    const p = presetById(id);
    setProvider(id); setBaseURL(p.baseURL); setModel(p.chatModel);
    if (!p.embedModel && id !== "custom") setEmbedMode("separate");
  };
  const pickEmb = (id: ProviderId) => {
    const p = presetById(id);
    setEmbProvider(id); setEmbURL(p.baseURL); setEmbModel(p.embedModel ?? "");
  };

  return (
    <form action={action} className="form">
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>1. Qual IA vai responder?</span>
        <div className="provider-grid" role="radiogroup">
          {PRESETS.map((p) => (
            <button type="button" key={p.id} role="radio" aria-checked={provider === p.id}
              className={`provider ${provider === p.id ? "active" : ""}`} onClick={() => pick(p.id)}>
              <b>{p.name}</b>
              <small>{p.embedModel ? "chat + busca" : p.id === "custom" ? "sua API" : "só chat"}</small>
            </button>
          ))}
        </div>
        <small>{preset.note}</small>
      </fieldset>

      <input type="hidden" name="chat_provider" value={provider} />
      <div className="grid-2">
        <label className="field"><span>Modelo de chat</span>
          <input className="input" name="chat_model" value={model} onChange={(e) => setModel(e.target.value)} required />
        </label>
        <label className="field"><span>Endereço da API</span>
          <input className="input" name="chat_base_url" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} required />
        </label>
      </div>
      <label className="field"><span>Chave de API</span>
        <input className="input" name="chat_key" type="password" autoComplete="off"
          placeholder={sameKeyProvider && current?.chat_key_hint ? `Chave salva (${current.chat_key_hint}) — deixe em branco para manter` : "Cole a chave do provedor"} />
        {preset.keyUrl && <small>Crie a chave em <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer">{new URL(preset.keyUrl).host}</a>. Ela fica criptografada e nunca volta para o navegador.</small>}
      </label>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>2. Busca nos documentos (embeddings)</span>
        <div className="chips">
          <button type="button" className={`chip ${embedMode === "same" ? "active" : ""}`} onClick={() => setEmbedMode("same")}
            disabled={!preset.embedModel && provider !== "custom"}>Usar a mesma IA</button>
          <button type="button" className={`chip ${embedMode === "separate" ? "active" : ""}`} onClick={() => setEmbedMode("separate")}>Outro provedor</button>
        </div>
        <input type="hidden" name="embed_mode" value={embedMode} />
        {embedMode === "same" && provider === "custom" && (
          <label className="field"><span>Modelo de embeddings</span><input className="input" name="embed_model" defaultValue={current?.embed_model ?? ""} placeholder="ex.: nomic-embed-text" /></label>
        )}
        {embedMode === "same" && preset.embedModel && <small>Modelo: {preset.embedModel} (1536 dimensões).</small>}
      </fieldset>

      {embedMode === "separate" && (
        <div className="subcard">
          <div className="chips">
            {EMBED_PRESETS.map((p) => (
              <button type="button" key={p.id} className={`chip ${embProvider === p.id ? "active" : ""}`} onClick={() => pickEmb(p.id)}>{p.name}</button>
            ))}
          </div>
          <input type="hidden" name="embed_provider" value={embProvider} />
          <div className="grid-2">
            <label className="field"><span>Modelo de embeddings</span>
              <input className="input" name="embed_model" value={embModel} onChange={(e) => setEmbModel(e.target.value)} required />
            </label>
            <label className="field"><span>Endereço da API</span>
              <input className="input" name="embed_base_url" value={embURL} onChange={(e) => setEmbURL(e.target.value)} required />
            </label>
          </div>
          <label className="field"><span>Chave de API (embeddings)</span>
            <input className="input" name="embed_key" type="password" autoComplete="off"
              placeholder={current?.embed_provider === embProvider && current?.embed_key_hint ? `Chave salva (${current.embed_key_hint}) — deixe em branco para manter` : "Cole a chave"} />
          </label>
        </div>
      )}

      <FormMessage state={state} />
      <div className="row row-wrap">
        <Submit pendingText="Testando a conexão…">Testar e salvar</Submit>
        {current && (
          <button type="button" className="btn btn-ghost btn-danger" disabled={pending}
            onClick={() => { if (confirm("Desconectar a IA da empresa? Os agentes param de responder até uma nova conexão.")) start(async () => { await removeAISettings(); router.refresh(); }); }}>
            Desconectar
          </button>
        )}
      </div>
    </form>
  );
}

const MODES = [
  ["owner", "A empresa dona paga", "Todos usam a IA conectada acima. Terceiros não precisam de conta de IA e nunca veem a chave."],
  ["member", "Cada participante paga", "Cada pessoa conecta a própria IA (conta da empresa dela, chave de API ou IA própria)."],
  ["mixed", "Misto", "A empresa dona paga por padrão; quem quiser (ou estourar o limite) usa a própria IA."],
] as const;

export function BillingForm({ current }: { current: { mode: "owner" | "member" | "mixed"; member: number | null; external: number | null } }) {
  const [state, action] = useActionState(saveProjectBilling, undefined);
  const [mode, setMode] = useState(current.mode);
  return (
    <form action={action} className="form">
      <div className="provider-grid" role="radiogroup" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {MODES.map(([id, title, desc]) => (
          <button type="button" key={id} role="radio" aria-checked={mode === id} className={`provider ${mode === id ? "active" : ""}`} onClick={() => setMode(id)}>
            <b>{title}</b><small style={{ fontFamily: "inherit" }}>{desc}</small>
          </button>
        ))}
      </div>
      <input type="hidden" name="billing_mode" value={mode} />
      {mode !== "member" && (
        <div className="grid-2">
          <label className="field"><span>Limite por pessoa (perguntas/mês)</span>
            <input className="input" name="monthly_limit_member" type="number" min={0} defaultValue={current.member ?? ""} placeholder="Sem limite" />
            <small>Vale para membros internos, pagos pela empresa.</small>
          </label>
          <label className="field"><span>Limite para terceiros (perguntas/mês)</span>
            <input className="input" name="monthly_limit_external" type="number" min={0} defaultValue={current.external ?? ""} placeholder="Sem limite" />
            <small>Ex.: 200. {mode === "mixed" ? "Ao estourar, o terceiro passa a usar a própria IA." : "Ao estourar, o terceiro fica sem perguntas até o próximo mês."}</small>
          </label>
        </div>
      )}
      <p className="small muted">A busca nos documentos (indexação) usa sempre a IA da empresa dona, em qualquer opção.</p>
      <FormMessage state={state} />
      <div><Submit>Salvar regra de cobrança</Submit></div>
    </form>
  );
}
