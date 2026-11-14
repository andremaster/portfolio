"use client";
import { useActionState } from "react";
import { updateProfile } from "@/app/actions/auth";
import { FormMessage, Submit } from "@/components/ui";

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="form">
      <label className="field"><span>Nome completo</span><input className="input" name="full_name" defaultValue={name} required /></label>
      <FormMessage state={state} />
      <div><Submit>Salvar</Submit></div>
      <a href="/reset-password" className="small" style={{ color: "var(--primary)" }}>Alterar senha</a>
    </form>
  );
}
