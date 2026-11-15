"use client";
import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/invites";
import { FormMessage, Submit } from "@/components/ui";

export function AcceptForm({ code, name, areas }: { code: string; name: string; areas: [string, string][] }) {
  const [state, action] = useActionState(acceptInvite.bind(null, code), undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="form">
      <label className="field"><span>Nome completo</span><input className="input" name="full_name" defaultValue={name} required /></label>
      <div className="grid-2">
        <label className="field"><span>Empresa</span><input className="input" name="company" placeholder="Onde você trabalha" required /></label>
        <label className="field"><span>Cargo</span><input className="input" name="job_title" placeholder="Ex.: Dev sênior" required /></label>
      </div>
      <label className="field"><span>Área no projeto</span>
        <select className="select" name="function" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {areas.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <small>Define quais fontes e agentes você vê e como a IA responde para você.</small>
      </label>
      <FormMessage state={state} />
      <Submit className="btn btn-primary btn-block" pendingText="Entrando…">Entrar no projeto</Submit>
    </form>
  );
}
