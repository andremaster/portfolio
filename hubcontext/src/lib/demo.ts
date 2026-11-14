/** Conteúdo fictício para demonstração — nenhum dado real. */
type Fn = "developer" | "data_engineer" | "data_analyst" | "legal" | "compliance" | "risk" | "business" | "product" | "other";

export const DEFAULT_AGENTS: { name: string; description: string; system_prompt: string; knowledge_scope: string[]; temperature: number; functions?: Fn[]; allow_external?: boolean }[] = [
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
  {
    name: "Jurídico & Privacidade",
    description: "Avalia o projeto sob a ótica da LGPD, contratos e uso de dados pessoais.",
    system_prompt: "Você é um assessor jurídico especializado em tecnologia e LGPD. Analise o projeto quanto a bases legais, uso de dados pessoais, obrigações contratuais com fornecedores e riscos jurídicos. Não substitui parecer formal: sinalize quando for necessário validar com o jurídico.",
    knowledge_scope: [],
    temperature: 0.1,
    functions: ["legal", "compliance", "risk", "business"],
    allow_external: false,
  },
  {
    name: "Compliance & Risco",
    description: "Mapeia controles, evidências, riscos e requisitos regulatórios do projeto.",
    system_prompt: "Você é um especialista em compliance e gestão de riscos de projetos de IA e dados. Identifique riscos (dados, modelo, fornecedor, operação), controles existentes, lacunas e evidências necessárias para auditoria.",
    knowledge_scope: [],
    temperature: 0.1,
    functions: ["compliance", "risk", "legal", "business"],
    allow_external: false,
  },
];

export const DEMO_BRIEF = {
  objective: "Reduzir em 50% o tempo de resposta a dúvidas internas de RH e TI com um assistente de IA (Projeto Atlas), sem expor dados pessoais de colaboradores.",
  scope: "Inclui: assistente web e Teams, base de conhecimento de RH/TI, indicadores no Fabric.\nNão inclui: decisões automáticas sobre colaboradores, integração com folha de pagamento.",
  business_rules: "- Um atendimento é resolvido quando fechado sem reabertura em 7 dias.\n- SLA de primeira resposta: 4 horas úteis.\n- Perguntas sobre salário individual devem ser encaminhadas ao RH, nunca respondidas pela IA.",
  restrictions: "- LGPD: nenhum dado pessoal identificável em prompts, logs ou amostras; e-mails e CPFs mascarados na camada Silver.\n- Fornecedores só acessam dados fictícios ou mascarados.\n- Modelos via Azure OpenAI no tenant da empresa; proibido enviar dados a APIs públicas.\n- Toda mudança de regra de negócio precisa de aprovação de Compliance.",
  success_criteria: "- 70% das perguntas respondidas sem escalonamento.\n- Satisfação ≥ 4/5.\n- Zero incidentes de dados pessoais.",
  stakeholders: "Patrocinador: Diretoria de Operações · Produto: Squad Atlas · Dados: Time de Engenharia de Dados · Jurídico/Compliance: validação de LGPD · Fornecedor: Parceiro de desenvolvimento do frontend",
  glossary: "Atendimento: ticket aberto por colaborador.\nReabertura: ticket fechado e reaberto em até 7 dias.\nCamada Gold: tabelas prontas para indicadores no Power BI.",
};

export const DEMO_SOURCES: { name: string; source_type: string; category: string; raw_text: string; audiences?: Fn[] }[] = [
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
  {
    name: "Avaliação de impacto LGPD (RIPD) — resumo",
    source_type: "document", category: "juridico",
    audiences: ["legal", "compliance", "risk"],
    raw_text: `# RIPD resumido — Projeto Atlas (fictício)

## Dados tratados
Nome e e-mail corporativo do colaborador, texto da pergunta e categoria do ticket.

## Base legal
Legítimo interesse (art. 7º, IX) para suporte interno. Teste de balanceamento aprovado em 2026-02.

## Riscos e controles
- Exposição de dados pessoais em prompts: mascaramento automático na camada Silver e filtro antes do envio ao modelo.
- Fornecedor com acesso a dados reais: proibido; somente amostras sintéticas.
- Retenção: conversas apagadas após 180 dias.`,
  },
  {
    name: "Matriz de riscos do projeto",
    source_type: "document", category: "risco",
    audiences: ["risk", "compliance", "legal", "business"],
    raw_text: `# Matriz de riscos — Projeto Atlas

| Risco | Prob. | Impacto | Controle |
|---|---|---|---|
| Resposta incorreta sobre benefícios | Média | Alto | Respostas citam fonte; RH revisa base mensalmente |
| Vazamento de dado pessoal | Baixa | Muito alto | Mascaramento, RLS, auditoria |
| Dependência do fornecedor de frontend | Média | Médio | Código no repositório da empresa, documentação obrigatória |
| Custo de IA acima do previsto | Média | Médio | Limite diário por usuário e alertas |`,
  },
  {
    name: "Amostra de dados — tickets (mascarada)",
    source_type: "document", category: "dados",
    raw_text: `# Amostra mascarada — bronze_tickets (10 linhas, dados fictícios)

ticket_id,aberto_em,categoria,status,colaborador_email,reaberto
T-1001,2026-05-02T09:14Z,ferias,fechado,c***@empresa.exemplo,false
T-1002,2026-05-02T10:01Z,senha,fechado,m***@empresa.exemplo,false
T-1003,2026-05-03T14:22Z,beneficios,aberto,j***@empresa.exemplo,false
T-1004,2026-05-04T08:40Z,vpn,fechado,a***@empresa.exemplo,true

## Dicionário
- ticket_id: identificador do atendimento.
- categoria: ferias | beneficios | senha | vpn | outros.
- colaborador_email: sempre mascarado fora da camada Bronze.
- reaberto: true se reaberto em até 7 dias.`,
  },
];
