"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { ActionState } from "./types";

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
};

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect(safeNext(form.get("next")));
}

const SignUp = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${env.appUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { ok: "Conta criada! Confirme o e-mail que enviamos para continuar." };
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(String(form.get("email") ?? ""), {
    redirectTo: `${env.appUrl()}/auth/callback?next=/reset-password`,
  });
  // Mesma resposta sempre, para não revelar quais e-mails existem
  return { ok: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa de pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Link expirado. Solicite uma nova redefinição." };
  redirect("/dashboard");
}

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const full_name = String(form.get("full_name") ?? "").trim();
  if (full_name.length < 2) return { error: "Informe seu nome." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  const { error } = await supabase.from("profiles").update({ full_name }).eq("id", user.id);
  return error ? { error: "Não foi possível salvar." } : { ok: "Perfil atualizado." };
}
