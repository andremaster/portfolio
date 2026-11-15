import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { keyHint } from "@/lib/ai-url";

/** Volta do OpenRouter: troca o código pela chave do usuário e salva como "Minha IA" (chave no Vault). */
export async function GET(req: Request) {
  const back = (q: string) => NextResponse.redirect(`${env.appUrl()}/minhas-ias?${q}`);
  const code = new URL(req.url).searchParams.get("code");
  const store = await cookies();
  const verifier = store.get("or_pkce")?.value;
  store.delete("or_pkce");
  if (!code || !verifier) return back("erro=openrouter");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${env.appUrl()}/login?next=/minhas-ias`);

  const r = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const data = r && r.ok ? await r.json().catch(() => null) as { key?: string } | null : null;
  if (!data?.key) return back("erro=openrouter");

  const admin = createAdminClient();
  const { data: row, error } = await admin.from("user_ai_connections").insert({
    user_id: user.id, label: "OpenRouter (minha conta)", provider: "openrouter", base_url: "https://openrouter.ai/api/v1",
    chat_model: "openai/gpt-4o-mini", key_hint: keyHint(data.key),
  }).select("id").single();
  if (error || !row) return back("erro=openrouter");
  const { data: sid, error: vErr } = await admin.rpc("ai_put_secret", { p_name: `nexo-user-ai-${row.id}`, p_secret: data.key });
  if (vErr) { await admin.from("user_ai_connections").delete().eq("id", row.id); return back("erro=openrouter"); }
  await admin.from("user_ai_connections").update({ secret_id: sid }).eq("id", row.id);
  return back("ok=openrouter");
}
