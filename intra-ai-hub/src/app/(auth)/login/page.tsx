"use client";
import Link from "next/link";
import { useActionState, use } from "react";
import { signIn } from "@/app/actions/auth";
import { FormMessage, Submit } from "@/components/ui";

export default function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = use(searchParams);
  const [state, action] = useActionState(signIn, params.error ? { error: "Link inválido ou expirado." } : undefined);
  return (
    <div className="card">
      <form action={action} className="form">
        <div><h1>Entrar</h1><p className="muted">Acesse o hub da sua empresa.</p></div>
        <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
        <label className="field"><span>E-mail</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Senha</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        <FormMessage state={state} />
        <Submit className="btn btn-primary btn-block" pendingText="Entrando…">Entrar</Submit>
        <div className="row small" style={{ justifyContent: "space-between" }}>
          <Link className="muted" href="/forgot-password">Esqueci a senha</Link>
          <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600 }}>Criar conta</Link>
        </div>
      </form>
    </div>
  );
}
