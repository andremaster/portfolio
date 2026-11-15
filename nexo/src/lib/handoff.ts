/** Handoff entre o Nexo e outras IAs (ChatGPT, Claude, Gemini, Copilot…). */

export const HANDOFF_SECTIONS = [
  ["objective", "Objetivo"],
  ["scope", "Escopo"],
  ["business_rules", "Regras de negócio"],
  ["restrictions", "Restrições"],
  ["success_criteria", "Critérios de sucesso"],
  ["stakeholders", "Envolvidos"],
  ["glossary", "Glossário"],
] as const;

export const EXTRA_SECTIONS = [
  "Arquitetura e decisões técnicas",
  "Estado atual",
  "Próximos passos",
  "Pendências e riscos",
  "Referências (arquivos, links, repositórios)",
] as const;

export type BriefField = (typeof HANDOFF_SECTIONS)[number][0];

/** Texto que o usuário cola na IA dele para gerar o handoff do projeto/conversa. */
export function handoffPrompt(projectName?: string) {
  const sections = [...HANDOFF_SECTIONS.map(([, t]) => t), ...EXTRA_SECTIONS];
  return `Preciso de um HANDOFF completo deste projeto${projectName ? ` (“${projectName}”)` : ""} para continuar o trabalho em outra ferramenta.

Regras:
- Use SOMENTE o que está nesta conversa, nos arquivos e nas instruções deste projeto. Não invente nada.
- Quando não houver informação, escreva "não informado".
- Seja específico: nomes de sistemas, tabelas, APIs, decisões tomadas e o motivo de cada uma.
- Não inclua senhas, chaves de API, tokens ou dados pessoais.

Responda em Markdown, exatamente com estes títulos de nível 2:

# HANDOFF — ${projectName ?? "<nome do projeto>"}
${sections.map((s) => `## ${s}`).join("\n")}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Extrai as seções da ficha a partir do Markdown do handoff. */
export function parseHandoff(md: string): Partial<Record<BriefField, string>> {
  const out: Partial<Record<BriefField, string>> = {};
  const parts = md.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [title, ...body] = part.split("\n");
    const text = body.join("\n").trim();
    if (!text || /^n[aã]o informado\.?$/i.test(text)) continue;
    const hit = HANDOFF_SECTIONS.find(([, t]) => norm(title).startsWith(norm(t)));
    if (hit) out[hit[0]] = text.slice(0, 20000);
  }
  return out;
}
