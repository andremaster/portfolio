/** Conteúdo fictício para demonstração — nenhum dado real. */
export const DEFAULT_AGENTS = [
  {
    name: "Arquiteto IA",
    description: "Explica arquitetura, componentes, integrações, dependências e decisões técnicas.",
    system_prompt: "Você é um arquiteto de soluções sênior. Explique a arquitetura do projeto, seus componentes, integrações, dependências e o motivo das decisões técnicas registradas. Quando útil, descreva fluxos passo a passo.",
    knowledge_scope: [] as string[],
    temperature: 0.2,
  },
  {
    name: "Copiloto de Desenvolvimento",
    description: "Orienta desenvolvedores e terceiros a implementar funcionalidades seguindo os padrões do projeto.",
    system_prompt: "Você é um copiloto de desenvolvimento. Oriente a implementação de funcionalidades seguindo estritamente os padrões, convenções e APIs documentados no projeto. Dê exemplos de código curtos quando ajudar e aponte os arquivos e documentos de referência.",
    knowledge_scope: [] as string[],
    temperature: 0.2,
  },
  {
    name: "Onboarding Técnico",
    description: "Apresenta o projeto a novos integrantes e indica os documentos essenciais.",
    system_prompt: "Você conduz o onboarding técnico de novos integrantes e empresas parceiras. Apresente o projeto em linguagem clara, indique por onde começar e quais documentos ler primeiro, em ordem.",
    knowledge_scope: [] as string[],
    temperature: 0.3,
  },
  {
    name: "Analista de Dados",
    description: "Responde sobre Microsoft Fabric, lakehouse, pipelines, camadas Bronze/Silver/Gold e modelos de dados.",
    system_prompt: "Você é um analista e engenheiro de dados especialista em Microsoft Fabric. Responda sobre lakehouse, pipelines, camadas Bronze, Silver e Gold, regras de negócio e modelos de dados do projeto.",
    knowledge_scope: ["dados", "arquitetura"],
    temperature: 0.2,
  },
];

export const DEMO_SOURCES = [
  {
    name: "Visão geral da arquitetura",
    source_type: "document", category: "arquitetura",
    raw_text: `# Visão geral da arquitetura — Projeto Atlas (fictício)

## Objetivo
O Atlas é um assistente de atendimento interno que responde dúvidas de colaboradores sobre processos de RH e TI.

## Componentes
- Frontend web em Next.js hospedado na Vercel.
- API de orquestração em Node.js que recebe a pergunta, consulta a base vetorial e chama o modelo de linguagem.
- Banco PostgreSQL com pgvector para embeddings.
- Azure OpenAI para geração de respostas (deployment gpt-4o-mini) e embeddings (text-embedding-3-small).
- Microsoft Fabric como plataforma de dados, alimentando indicadores de uso.

## Fluxo de uma pergunta
1. O usuário envia a pergunta pelo frontend.
2. A API valida o token do Entra ID e o perfil do usuário.
3. A pergunta é convertida em embedding e os 6 trechos mais próximos são recuperados.
4. O modelo gera a resposta citando as fontes.
5. A interação é registrada para auditoria e métricas.`,
  },
  {
    name: "ADR-007 — Uso de pgvector em vez de banco vetorial dedicado",
    source_type: "decision", category: "arquitetura",
    raw_text: `# ADR-007 — pgvector em vez de banco vetorial dedicado

Status: Aceita. Data: 2026-03-02.

## Contexto
O volume previsto é inferior a 2 milhões de trechos e a equipe já opera PostgreSQL.

## Decisão
Usar a extensão pgvector com índice HNSW no PostgreSQL existente, em vez de Pinecone ou Qdrant.

## Consequências
- Menor custo e um único banco para dados e vetores.
- Permissões aplicadas com Row Level Security na mesma consulta.
- Reavaliar se o volume passar de 10 milhões de trechos ou a latência p95 passar de 300 ms.`,
  },
  {
    name: "Padrões de desenvolvimento",
    source_type: "manual", category: "desenvolvimento",
    raw_text: `# Padrões de desenvolvimento

## Branches e commits
- Branch principal: main. Funcionalidades em feature/<ticket>-<descricao>.
- Commits no padrão Conventional Commits (feat:, fix:, docs:, chore:).
- Todo PR precisa de 1 aprovação e pipeline verde no Azure DevOps.

## Código
- TypeScript com strict ativado. Proibido usar any sem justificativa.
- Validação de entrada com zod em todas as rotas de API.
- Segredos somente em variáveis de ambiente ou Azure Key Vault. Nunca no código.
- Logs estruturados em JSON, sem dados pessoais.

## Nova funcionalidade de API
1. Criar o schema zod em src/schemas.
2. Criar o handler em src/routes com testes em tests/routes.
3. Registrar a rota no OpenAPI (docs/openapi.yaml).
4. Adicionar o evento de auditoria correspondente.`,
  },
  {
    name: "Modelo de dados — Lakehouse Fabric",
    source_type: "document", category: "dados",
    raw_text: `# Lakehouse no Microsoft Fabric

## Camadas
- Bronze: dados brutos ingeridos a cada hora pelos pipelines do Data Factory (tabelas bronze_tickets, bronze_users). Sem transformação.
- Silver: dados limpos e deduplicados. Regras: remover tickets de teste, padronizar datas em UTC, mascarar e-mails.
- Gold: modelos dimensionais para Power BI — fato_atendimentos, dim_colaborador, dim_categoria.

## Regras de negócio
- Um atendimento é considerado resolvido quando o status final é "fechado" e não há reabertura em 7 dias.
- O SLA de primeira resposta é de 4 horas úteis.

## Pipelines
- pl_ingest_tickets (hora em hora), pl_silver_transform (diário 02:00), pl_gold_refresh (diário 03:00).`,
  },
  {
    name: "API de atendimento — especificação",
    source_type: "api_spec", category: "desenvolvimento",
    raw_text: `# API de atendimento v1

Autenticação: Bearer token do Entra ID. Base URL: https://api.atlas.exemplo/v1

## POST /questions
Envia uma pergunta. Corpo: { "text": string, "channel": "web" | "teams" }.
Resposta 200: { "answer": string, "sources": [{ "title": string, "score": number }] }.
Erros: 401 token inválido, 429 limite de 60 requisições por minuto.

## GET /questions/{id}
Retorna a pergunta e a resposta registradas.`,
  },
];
