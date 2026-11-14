"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSource, deleteSource, getSourceFileUrl, reprocessSource } from "@/app/actions/knowledge";
import { FormMessage, Sheet, Submit } from "@/components/ui";
import { Icon, sourceLabel } from "@/components/icons";

type Mode = "file" | "url" | "text";

export function AddSource({ categories, autoOpen }: { categories: string[]; autoOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [mode, setMode] = useState<Mode>("file");
  const [state, action] = useActionState(addSource, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setOpen(false); router.refresh(); } }, [state, router]);

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Adicionar</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Adicionar conhecimento">
        <form action={action} className="form">
          <div className="chips" role="tablist">
            {([["file", "Arquivo"], ["url", "URL"], ["text", "Texto"]] as const).map(([m, l]) => (
              <button type="button" key={m} role="tab" aria-selected={mode === m} className={`chip ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>{l}</button>
            ))}
          </div>
          {mode === "file" && (
            <label className="field"><span>Arquivo</span>
              <input className="input" type="file" name="file" required
                accept=".pdf,.docx,.txt,.md,.csv,.json,.yaml,.yml,.html,.sql,.py,.ts,.tsx,.js,.jsx,.java,.cs,.go,.png,.jpg,.jpeg,.svg" />
              <small>PDF, Word, Markdown, texto, código, OpenAPI. Até 20 MB. Para imagens e diagramas, descreva o conteúdo abaixo.</small>
            </label>
          )}
          {mode === "url" && (
            <label className="field"><span>URL pública</span><input className="input" name="source_url" type="url" placeholder="https://…" required /></label>
          )}
          <label className="field"><span>Nome</span><input className="input" name="name" placeholder="Opcional — usa o nome do arquivo" required={mode === "text"} /></label>
          <div className="grid-2">
            <label className="field"><span>Tipo</span>
              <select className="select" name="source_type" defaultValue={mode === "text" ? "decision" : "document"}>
                {Object.entries(sourceLabel).filter(([k]) => k !== "url").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>Categoria</span>
              <input className="input" name="category" list="cats" defaultValue="geral" required />
              <datalist id="cats">{[...new Set([...categories, "arquitetura", "desenvolvimento", "dados", "negocio", "onboarding"])].map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
          <label className="field"><span>{mode === "text" ? "Conteúdo" : "Descrição / contexto (opcional)"}</span>
            <textarea className="textarea" name="raw_text" required={mode === "text"} placeholder={mode === "text" ? "Cole aqui a decisão técnica, regra de negócio, procedimento…" : "Ajuda a IA a entender este material."} />
          </label>
          <FormMessage state={state} />
          <Submit pendingText="Enviando e indexando…">Salvar e indexar</Submit>
        </form>
      </Sheet>
    </>
  );
}

export function SourceActions({ id, name, hasFile, canWrite, canDelete }: { id: string; name: string; hasFile: boolean; canWrite: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ error?: string; ok?: string } | undefined>) =>
    start(async () => { const r = await fn(); if (r?.error) alert(r.error); router.refresh(); });

  return (
    <div className="row" style={{ gap: 4 }}>
      {hasFile && (
        <button className="btn btn-ghost icon-btn" title="Abrir original" disabled={pending}
          onClick={() => start(async () => { const r = await getSourceFileUrl(id); if (r.url) window.open(r.url, "_blank", "noopener"); else alert(r.error); })}>
          <Icon name="external" size={16} />
        </button>
      )}
      {canWrite && (
        <button className="btn btn-ghost icon-btn" title="Reprocessar" disabled={pending} onClick={() => run(() => reprocessSource(id))}>
          <Icon name="refresh" size={16} className={pending ? "spin" : ""} />
        </button>
      )}
      {canDelete && (
        <button className="btn btn-ghost btn-danger icon-btn" title="Excluir" disabled={pending}
          onClick={() => { if (confirm(`Excluir “${name}” e todos os seus trechos indexados? Essa ação não pode ser desfeita.`)) run(() => deleteSource(id)); }}>
          <Icon name="trash" size={16} />
        </button>
      )}
    </div>
  );
}
