"use client";
import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { FormMessage, Submit } from "@/components/ui";

export default function Reset() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <div className="card">
      <form action={action} className="form">
        <div><h1>Definir senha</h1><p className="muted">Escolha uma nova senha de acesso.</p></div>
        <label className="field"><span>Nova senha</span><input className="input" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
        <FormMessage state={state} />
        <Submit className="btn btn-primary btn-block">Salvar senha</Submit>
      </form>
    </div>
  );
}
