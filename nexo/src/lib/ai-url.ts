/** Bloqueia endereços internos (rede da VPS, localhost, IPs) — evita acesso à infraestrutura. */
export function checkAIUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "Endereço da API inválido."; }
  if (process.env.ALLOW_PRIVATE_AI_URLS === "true") return null;
  if (u.protocol !== "https:") return "Use um endereço https:// do provedor.";
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return "Endereço interno não é permitido.";
  if (/^(\d+\.){3}\d+$/.test(h) || h.includes(":")) return "Use o domínio do provedor, não um IP.";
  return null;
}

export const keyHint = (key: string) => (key.length >= 8 ? `…${key.slice(-4)}` : "…");
