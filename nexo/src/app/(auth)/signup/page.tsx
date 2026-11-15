"use client";
import Link from "next/link";
import { useActionState, use } from "react";
import { signUp } from "@/app/actions/auth";
import { FormMessage, Submit } from "@/components/ui";

export default function Signup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = use(searchParams);
  const [state, action] = useActionState(signUp, undefined);
  return (
    <div className="card">
      <form action={action} className="form">
        <input type="hidden" name="next" value={params.next ?? ""} />
        <div><h1>Criar conta</h1><p className="muted">Comece com um projeto de demonstração pronto.</p></div>
        <label className="field"><span>Nome completo</span><input className="input" name="full_name" autoComplete="name" required /></label>
        <label className="field"><span>E-mail corporativo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Senha</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /><small>Mínimo de 8 caracteres.</small></label>
        <FormMessage state={state} />
        <Submit className="btn btn-primary btn-block" pendingText="Criando…">Criar conta</Submit>
        <p className="small muted" style={{ textAlign: "center" }}>Já tem conta? <Link href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"} style={{ color: "var(--primary)", fontWeight: 600 }}>Entrar</Link></p>
      </form>
    </div>
  );
}
