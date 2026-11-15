import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** Inicia o login no OpenRouter (OAuth PKCE): o usuário entra na conta dele e autoriza o Nexo. */
export async function GET() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://openrouter.ai/auth");
  url.searchParams.set("callback_url", `${env.appUrl()}/api/openrouter/callback`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  const res = NextResponse.redirect(url);
  res.cookies.set("or_pkce", verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/openrouter", maxAge: 600 });
  return res;
}
