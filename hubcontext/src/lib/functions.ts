export const FUNCTIONS = [
  "developer", "data_engineer", "data_analyst", "legal", "compliance", "risk", "business", "product", "other",
] as const;
export type MemberFunction = (typeof FUNCTIONS)[number];

export const functionLabel: Record<MemberFunction, string> = {
  developer: "Desenvolvimento",
  data_engineer: "Engenharia de dados",
  data_analyst: "Análise de dados",
  legal: "Jurídico",
  compliance: "Compliance",
  risk: "Risco",
  business: "Negócio",
  product: "Produto",
  other: "Outra",
};

/** Como a IA deve adaptar a resposta para cada função. */
export const functionFocus: Record<MemberFunction, string> = {
  developer: "Foque em implementação: arquitetura, padrões de código, APIs, testes e passos concretos.",
  data_engineer: "Foque em pipelines, modelagem, camadas Bronze/Silver/Gold, qualidade e linhagem de dados.",
  data_analyst: "Foque em significado dos dados, indicadores, regras de cálculo e uso correto das amostras.",
  legal: "Foque em obrigações legais, LGPD, uso de dados pessoais, contratos e responsabilidades. Aponte riscos jurídicos.",
  compliance: "Foque em políticas internas, requisitos regulatórios, controles, evidências e trilha de auditoria.",
  risk: "Foque em riscos operacionais, de dados, de modelo e de fornecedor, seus controles e impactos.",
  business: "Foque em objetivo, regras de negócio e impacto, em linguagem não técnica.",
  product: "Foque em escopo, requisitos, critérios de sucesso e priorização.",
  other: "Responda de forma clara e equilibrada.",
};
