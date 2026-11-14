"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { FormMessage, Submit } from "@/components/ui";

export default function Forgot() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="card">
      <form action={action} className="form">
        <div><h1>Recuperar senha</h1><p className="muted">Enviaremos um link para redefinir sua senha.</p></div>
        <label className="field"><span>E-mail</span><input className="input" name="email" type="email" required /></label>
        <FormMessage state={state} />
        <Submit className="btn btn-primary btn-block" pendingText="Enviando…">Enviar link</Submit>
        <Link href="/login" className="small muted" style={{ textAlign: "center" }}>Voltar ao login</Link>
      </form>
    </div>
  );
}
