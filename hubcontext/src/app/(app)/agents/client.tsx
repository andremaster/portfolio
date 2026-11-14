"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgent, toggleAgent } from "@/app/actions/agents";
import { FormMessage, Sheet, Submit } from "@/components/ui";
import { Icon } from "@/components/icons";
import { FUNCTIONS, functionLabel } from "@/lib/functions";

type Agent = { functions?: string[]; id: string; name: string; description: string | null; system_prompt: string; knowledge_scope: string[]; model: string | null; temperature: number; allow_external: boolean };

export function AgentEditor({ agent }: { agent?: Agent }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveAgent, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setOpen(false); router.refresh(); } }, [state, router]);
  return (
    <>
      {agent
        ? <button className="btn btn-sm" onClick={() => setOpen(true)}>Editar</button>
        : <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Novo agente</button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={agent ? `Editar ${agent.name}` : "Novo agente"}>
        <form action={action} className="form">
          {agent && <input type="hidden" name="id" value={agent.id} />}
          <label className="field"><span>Nome</span><input className="input" name="name" defaultValue={agent?.name} required /></label>
          <label className="field"><span>Descrição</span><input className="input" name="description" defaultValue={agent?.description ?? ""} /></label>
          <label className="field"><span>Prompt do agente</span>
            <textarea className="textarea" name="system_prompt" defaultValue={agent?.system_prompt} required style={{ minHeight: 160 }} />
            <small>As regras de segurança e de citação de fontes são adicionadas automaticamente.</small>
          </label>
          <label className="field"><span>Escopo de conhecimento</span>
            <input className="input" name="knowledge_scope" defaultValue={agent?.knowledge_scope?.join(", ")} placeholder="ex.: arquitetura, dados — vazio = todas" />
          </label>
          <div className="grid-2">
            <label className="field"><span>Modelo (opcional)</span><input className="input" name="model" defaultValue={agent?.model ?? ""} placeholder="padrão do ambiente" /></label>
            <label className="field"><span>Temperatura</span><input className="input" name="temperature" type="number" step="0.1" min="0" max="1.5" defaultValue={agent?.temperature ?? 0.2} /></label>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <span>Disponível para as áreas</span>
            <div className="chips" style={{ flexWrap: "wrap" }}>
              {FUNCTIONS.filter((f) => f !== "other").map((f) => (
                <label key={f} className="chip" style={{ gap: 6 }}><input type="checkbox" name="functions" value={f} defaultChecked={agent?.functions?.includes(f)} /> {functionLabel[f]}</label>
              ))}
            </div>
            <small>Nenhuma marcada = todas as áreas.</small>
          </fieldset>
          <label className="check"><input type="checkbox" name="allow_external" defaultChecked={agent?.allow_external ?? true} /><span>Disponível para usuários externos</span></label>
          <FormMessage state={state} />
          <Submit>{agent ? "Salvar alterações" : "Criar agente"}</Submit>
        </form>
      </Sheet>
    </>
  );
}

export function AgentToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn btn-sm btn-ghost" disabled={pending}
      onClick={() => start(async () => { const r = await toggleAgent(id, !active); if (r?.error) alert(r.error); router.refresh(); })}>
      {active ? "Desativar" : "Ativar"}
    </button>
  );
}
