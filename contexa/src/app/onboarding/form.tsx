"use client";
import { useActionState } from "react";
import { createOrganization } from "@/app/actions/projects";
import { FormMessage, Submit } from "@/components/ui";

export function OnboardingForm({ name }: { name: string }) {
  const [state, action] = useActionState(createOrganization, undefined);
  return (
    <form action={action} className="form">
      <div>
        <h1>Bem-vindo{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p className="muted">Crie o espaço da sua empresa. Os dados ficam isolados de outros clientes.</p>
      </div>
      <label className="field"><span>Nome da empresa</span><input className="input" name="name" required minLength={2} placeholder="Ex.: Acme Tecnologia" /></label>
      <label className="check"><input type="checkbox" name="demo" defaultChecked />
        <span>Criar projeto de demonstração com agentes e documentos fictícios<br /><small className="muted">Recomendado para testar o chat imediatamente.</small></span></label>
      <FormMessage state={state} />
      <Submit className="btn btn-primary btn-block" pendingText="Preparando seu hub… (até 1 min)">Criar meu hub</Submit>
    </form>
  );
}
