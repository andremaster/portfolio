"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, removeMember, updateMember } from "@/app/actions/team";
import { setSourceGrant } from "@/app/actions/knowledge";
import { FormMessage, Sheet, Submit } from "@/components/ui";
import { Icon } from "@/components/icons";

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

