export function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
export function timeAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
  return "agora";
}

export const roleLabel: Record<string, string> = { admin: "Administrador", collaborator: "Colaborador", reader: "Leitor", owner: "Proprietário", member: "Membro" };
export const envLabel: Record<string, string> = { development: "Desenvolvimento", staging: "Homologação", production: "Produção" };
