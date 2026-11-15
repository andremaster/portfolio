"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, removeMember, updateMember } from "@/app/actions/team";
import { setSourceGrant } from "@/app/actions/knowledge";
import { approveMember, createInvite, revokeInvite } from "@/app/actions/invites";
import { FormMessage, Sheet, Submit } from "@/components/ui";
import { Icon } from "@/components/icons";
import { FUNCTIONS, functionLabel, type MemberFunction } from "@/lib/functions";

export function InviteMember() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(inviteMember, undefined);
  const [external, setExternal] = useState(false);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Convidar</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Convidar pessoa">
        <form action={action} className="form">
          <label className="field"><span>E-mail</span><input className="input" name="email" type="email" required /></label>
          <label className="field"><span>Função</span>
            <select className="select" name="role" defaultValue="reader">
              {!external && <option value="admin">Administrador</option>}
              <option value="collaborator">Colaborador</option>
              <option value="reader">Leitor</option>
            </select>
          </label>
          <label className="field"><span>Área / função</span>
            <select className="select" name="function" defaultValue="developer">
              {FUNCTIONS.map((f) => <option key={f} value={f}>{functionLabel[f]}</option>)}
            </select>
            <small>Define o contexto e os agentes que a pessoa recebe.</small>
          </label>
          <label className="check"><input type="checkbox" name="is_external" checked={external} onChange={(e) => setExternal(e.target.checked)} />
            <span>Usuário externo (terceiro)<br /><small className="muted">Só verá as fontes que você liberar depois.</small></span></label>
          <FormMessage state={state} />
          <Submit pendingText="Enviando convite…">Enviar convite</Submit>
        </form>
      </Sheet>
    </>
  );
}

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => { const r = await fn(); if (r?.error) alert(r.error); router.refresh(); });
  return { pending, run };
}

export function MemberRole({ id, role, isExternal }: { id: string; role: "admin" | "collaborator" | "reader"; isExternal: boolean }) {
  const { pending, run } = useRun();
  return (
    <select className="select" style={{ height: 34, padding: "0 8px", width: "auto" }} value={role} disabled={pending}
      onChange={(e) => run(() => updateMember(id, { role: e.target.value as typeof role, is_external: isExternal }))}>
      {!isExternal && <option value="admin">Administrador</option>}
      <option value="collaborator">Colaborador</option>
      <option value="reader">Leitor</option>
    </select>
  );
}

export function MemberActions({ id, userId, name, isExternal, sources, granted }: {
  id: string; userId: string; name: string; isExternal: boolean;
  sources: { id: string; name: string; category: string }[]; granted: string[];
}) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
      {isExternal && <button className="btn btn-sm" onClick={() => setOpen(true)}><Icon name="shield" size={14} /> Escopo</button>}
      <button className="btn btn-sm btn-ghost hide-sm" disabled={pending}
        onClick={() => run(() => updateMember(id, isExternal ? { is_external: false } : { is_external: true, role: "reader" }))}>
        {isExternal ? "Tornar interno" : "Tornar externo"}
      </button>
      <button className="btn btn-sm btn-ghost btn-danger" disabled={pending}
        onClick={() => { if (confirm(`Remover o acesso de ${name} a este projeto?`)) run(() => removeMember(id)); }}>Remover</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Fontes liberadas para ${name}`}>
        <div className="form">
          <p className="small muted">Este usuário externo só verá (e a IA só usará para ele) as fontes marcadas.</p>
          {sources.length === 0 && <p className="muted">Nenhuma fonte no projeto.</p>}
          {sources.map((s) => (
            <label className="check" key={s.id}>
              <input type="checkbox" defaultChecked={granted.includes(s.id)} disabled={pending}
                onChange={(e) => run(() => setSourceGrant(s.id, userId, e.target.checked))} />
              <span>{s.name} <small className="muted">· {s.category}</small></span>
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  );
}


export function MemberFunctionSelect({ id, fn }: { id: string; fn: MemberFunction }) {
  const { pending, run } = useRun();
  return (
    <select className="select" style={{ height: 34, padding: "0 8px", width: "auto" }} value={fn} disabled={pending}
      onChange={(e) => run(() => updateMember(id, { function: e.target.value as MemberFunction }))}>
      {FUNCTIONS.map((f) => <option key={f} value={f}>{functionLabel[f]}</option>)}
    </select>
  );
}

type InviteRow = { id: string; code: string; label: string | null; role: string; is_external: boolean; allowed_functions: string[]; requires_approval: boolean; max_uses: number | null; uses: number; expires_at: string | null; revoked: boolean };

/** Links de convite: o dono cria, envia, e cada convidado escolhe cargo e área ao entrar. */
export function InviteLinks({ invites, origin }: { invites: InviteRow[]; origin: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createInvite, undefined);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const copy = async (code: string) => { await navigator.clipboard.writeText(`${origin}/convite/${code}`); setCopied(code); setTimeout(() => setCopied(null), 2000); };
  const now = Date.now();

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Links de convite</h2><p className="small muted">Envie para terceiros: eles criam a conta, informam empresa, cargo e área, e entram com as regras que você definir.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="link" size={16} /> Criar link</button>
      </div>
      <div className="list">
        {invites.length === 0 && <p className="muted small">Nenhum link criado.</p>}
        {invites.map((i) => {
          const dead = i.revoked || (i.expires_at && new Date(i.expires_at).getTime() < now) || (i.max_uses !== null && i.uses >= i.max_uses);
          return (
            <div className="list-item" key={i.id} style={{ opacity: dead ? .55 : 1 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{i.label || "Convite"} {dead ? <span className="badge">inativo</span> : <span className="badge badge-ok">ativo</span>}</div>
                <div className="small muted">
                  {i.role === "reader" ? "Leitor" : "Colaborador"}{i.is_external ? " · terceiro" : " · interno"}
                  {i.requires_approval ? " · com aprovação" : ""} · usos {i.uses}{i.max_uses ? `/${i.max_uses}` : ""}
                  {i.expires_at ? ` · até ${new Date(i.expires_at).toLocaleDateString("pt-BR")}` : ""}
                  {i.allowed_functions.length ? ` · áreas: ${i.allowed_functions.map((f) => functionLabel[f as MemberFunction]).join(", ")}` : ""}
                </div>
              </div>
              {!dead && <button className="btn btn-sm" onClick={() => copy(i.code)}><Icon name="copy" size={14} /> {copied === i.code ? "Copiado!" : "Copiar link"}</button>}
              {!i.revoked && <button className="btn btn-ghost btn-danger btn-sm" disabled={pending}
                onClick={() => start(async () => { await revokeInvite(i.id); router.refresh(); })}>Desativar</button>}
            </div>
          );
        })}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Novo link de convite">
        <form action={action} className="form">
          <label className="field"><span>Nome do link</span><input className="input" name="label" placeholder="Ex.: Equipe da Fornecedora X" /></label>
          <div className="grid-2">
            <label className="field"><span>Permissão</span>
              <select className="select" name="role" defaultValue="collaborator"><option value="collaborator">Colaborador</option><option value="reader">Leitor</option></select>
            </label>
            <label className="field"><span>Validade (dias)</span><input className="input" name="days" type="number" min={1} max={90} defaultValue={7} /></label>
          </div>
          <label className="field"><span>Máximo de pessoas</span><input className="input" name="max_uses" type="number" min={1} placeholder="Sem limite" /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <span>Áreas que o convidado pode escolher</span>
            <div className="chips" style={{ flexWrap: "wrap", borderRadius: 14 }}>
              {FUNCTIONS.filter((f) => f !== "other").map((f) => (
                <label key={f} className="chip" style={{ gap: 6 }}><input type="checkbox" name="allowed_functions" value={f} /> {functionLabel[f]}</label>
              ))}
            </div>
            <small>Nenhuma marcada = todas.</small>
          </fieldset>
          <label className="check"><input type="checkbox" name="is_external" defaultChecked /> Terceiro (vê só as fontes que você liberar)</label>
          <label className="check"><input type="checkbox" name="requires_approval" /> Eu aprovo cada entrada antes de liberar</label>
          <FormMessage state={state} />
          {state?.link && <div className="row"><code className="grow ellipsis">{origin}{state.link}</code>
            <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard.writeText(`${origin}${state.link}`)}>Copiar</button></div>}
          <Submit pendingText="Criando…">Criar link</Submit>
        </form>
      </Sheet>
    </section>
  );
}

export function ApproveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await approveMember(id); router.refresh(); })}>Aprovar</button>;
}
