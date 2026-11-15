"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUserConnection, deleteUserConnection, setProjectAI } from "@/app/actions/user-ai";
import { FormMessage, Submit } from "@/components/ui";
import { PRESETS, presetById, type ProviderId } from "@/services/ai/presets";

export function AddConnection() {
  const [state, action] = useActionState(addUserConnection, undefined);
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const p = presetById(provider);
  const [url, setUrl] = useState(p.baseURL);
  const [model, setModel] = useState(p.chatModel);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setFormKey((k) => k + 1); router.refresh(); } }, [state, router]);
  const pick = (id: ProviderId) => { const x = presetById(id); setProvider(id); setUrl(x.baseURL); setModel(x.chatModel); };

  return (
    <form action={action} className="form" key={formKey}>
      <div className="provider-grid">
        {PRESETS.map((x) => (
          <button type="button" key={x.id} className={`provider ${provider === x.id ? "active" : ""}`} onClick={() => pick(x.id)}>
            <b>{x.name}</b><small>{x.id === "custom" ? "IA própria" : "chave de API"}</small>
          </button>
        ))}
      </div>
      <input type="hidden" name="provider" value={provider} />
      <div className="grid-2">
        <label className="field"><span>Modelo</span><input className="input" name="chat_model" value={model} onChange={(e) => setModel(e.target.value)} required /></label>
        <label className="field"><span>Endereço da API</span><input className="input" name="base_url" value={url} onChange={(e) => setUrl(e.target.value)} required /></label>
      </div>
      <label className="field"><span>Chave de API</span>
        <input className="input" name="api_key" type="password" autoComplete="off" placeholder={provider === "custom" ? "Opcional para IA própria" : "Cole a sua chave"} />
        {p.keyUrl && <small>Crie em <a href={p.keyUrl} target="_blank" rel="noopener noreferrer">{new URL(p.keyUrl).host}</a>. Fica criptografada; ninguém do projeto vê.</small>}
      </label>
      <label className="field"><span>Nome (opcional)</span><input className="input" name="label" placeholder="Ex.: Meu Claude da empresa" /></label>
      <FormMessage state={state} />
      <Submit pendingText="Testando a conexão…">Testar e conectar</Submit>
    </form>
  );
}

export function ConnectionList({ items }: { items: { id: string; label: string; model: string; hint: string | null }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!items.length) return <p className="muted small">Nenhuma IA conectada ainda.</p>;
  return (
    <div className="list">
      {items.map((c) => (
        <div className="list-item" key={c.id}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{c.label}</div>
            <div className="small muted mono">{c.model}{c.hint ? ` · chave ${c.hint}` : ""}</div>
          </div>
          <button className="btn btn-ghost btn-danger btn-sm" disabled={pending}
            onClick={() => { if (confirm(`Remover “${c.label}”?`)) start(async () => { await deleteUserConnection(c.id); router.refresh(); }); }}>Remover</button>
        </div>
      ))}
    </div>
  );
}

export function ProjectAIChoice({ mode, current, connections, limit }: { mode: "owner" | "member" | "mixed"; current: string | null; connections: { id: string; label: string }[]; limit: number | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const router = useRouter();
  if (mode === "owner") return <p className="muted">A empresa dona paga as perguntas deste projeto. Você não precisa conectar nenhuma IA.{limit !== null ? ` Seu limite: ${limit} perguntas por mês.` : ""}</p>;
  return (
    <div className="form">
      <p className="muted small">{mode === "member" ? "Escolha qual das suas IAs responde neste projeto. O custo vai para a sua conta no provedor." : `Use a IA da empresa dona${limit !== null ? ` (até ${limit} perguntas/mês)` : ""} ou a sua.`}</p>
      <div className="row row-wrap">
        <select className="select" style={{ maxWidth: 360 }} defaultValue={current ?? ""} disabled={pending}
          onChange={(e) => start(async () => { setMsg(await setProjectAI(e.target.value || null)); router.refresh(); })}>
          {mode === "mixed" && <option value="">IA da empresa dona</option>}
          {mode === "member" && <option value="" disabled>Escolha uma IA…</option>}
          {connections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {connections.length === 0 && <span className="small muted">Conecte uma IA abaixo primeiro.</span>}
      </div>
      <FormMessage state={msg} />
    </div>
  );
}
