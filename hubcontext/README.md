# HubContext · Autyma

A memória técnica dos projetos de IA de uma empresa. Agentes especializados respondem com **RAG** sobre documentos, código, APIs e decisões técnicas, **citando as fontes** e **respeitando as permissões** de cada pessoa, inclusive de terceiros.

Produto SaaS multi-empresa: cada cliente cria a sua organização, com dados isolados por Row Level Security.

## Stack
Next.js 15 (App Router, TypeScript) · Supabase (Postgres + pgvector, Auth, Storage, RLS) · OpenAI ou Azure OpenAI · Vercel

## Publicar (cerca de 15 minutos)

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute em ordem o conteúdo de:
   `supabase/migrations/0001_core.sql`, `0002_security.sql`, `0003_storage_usage.sql` e `0004_brief_functions.sql`.
   (Ou use a CLI: `supabase link` e depois `supabase db push`.)
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://SEU-DOMINIO`
   - Redirect URLs: `https://SEU-DOMINIO/auth/callback`
4. Em **Project Settings → API**, copie a URL, a `anon key` e a `service_role key`.

### 2. Chave de IA
- **OpenAI:** crie uma chave em platform.openai.com e use `AI_PROVIDER=openai`.
- **Azure OpenAI:** crie dois deployments, um de chat (ex.: `gpt-4o-mini`) e um de embeddings (`text-embedding-3-small`), e use `AI_PROVIDER=azure`.

### 3. Vercel
1. **Add New → Project** e importe o repositório.
2. **Root Directory:** `hubcontext`.
3. Em **Environment Variables**, preencha as variáveis do `.env.example`. `NEXT_PUBLIC_APP_URL` deve ser a URL final.
4. Clique em **Deploy**. Para ambientes separados, use outro projeto Supabase e as variáveis por ambiente da Vercel (Preview × Production).

### 4. Primeiro acesso
Abra a URL, clique em **Criar conta**, confirme o e-mail e crie a empresa com a opção **projeto de demonstração** marcada. Você já cai em um projeto com 4 agentes e 5 documentos fictícios indexados, pronto para o chat.

## Desenvolvimento local
```bash
cp .env.example .env.local   # preencha
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes unitários (chunking)
npm run test:db              # migrations + testes de RLS num Postgres temporário (requer postgresql-16 e pgvector)
```

## Arquitetura
```
Navegador ──(só anon key + sessão)──▶ Next.js (Vercel)
                                      ├─ Server Components / Actions → Supabase com a sessão do usuário (RLS)
                                      ├─ /api/chat                   → embedding → match_chunks (RLS) → LLM → histórico + fontes
                                      ├─ /api/sources/[id]/index     → extrai → chunks → embeddings
                                      └─ services/ai                 → OpenAI | Azure OpenAI
Supabase: Auth · Postgres + pgvector (HNSW) · Storage privado · RLS · auditoria por trigger
```

| Pasta | Conteúdo |
|---|---|
| `supabase/migrations` | Schema, RLS, busca vetorial, auditoria, storage |
| `src/services/ai` | Adaptador de provedor de IA |
| `src/services/rag` | Extração (PDF, DOCX, texto, código, URL), chunking, indexação, prompt |
| `src/services/integrations` | Contrato de adaptadores e catálogo de integrações |
| `src/app/actions` | Server Actions (auth, projetos, conhecimento, agentes, equipe) |
| `src/app/(app)` | Dashboard, Base, Chat, Agentes, Equipe, Projetos, Integrações, Perfil |
| `tests/sql` | Testes de isolamento e permissões no banco |

## Segurança
- **RLS em todas as tabelas.** Usuários só veem as organizações e os projetos dos quais são membros.
- **A busca vetorial roda com a sessão do usuário** (`match_chunks` é `SECURITY INVOKER`), então a IA nunca recebe trechos que a pessoa não pode ver.
- **Externos** (`is_external`) só enxergam as fontes liberadas em `source_access`, tanto na listagem quanto no RAG.
- **Service Role apenas no servidor** (`server-only`), usada depois da checagem de permissão para gravar embeddings e enviar convites.
- **Storage privado.** Os arquivos abrem por URL assinada de 5 minutos.
- **Auditoria** por trigger em projetos, membros, fontes, agentes, acessos e integrações, e também em cada consulta ao chat.
- **Proteção contra prompt injection:** os trechos entram no prompt delimitados e marcados como dados, não como instruções.
- **Sem fonte, sem resposta:** quando não há trecho relevante, o agente diz que não encontrou a informação, em vez de inventar.
- **Limite diário de perguntas** por usuário (`CHAT_DAILY_LIMIT`).
- **Proteção contra SSRF** na importação de URLs.

## Ficha do projeto e áreas
- **Ficha do projeto** (`/brief`): objetivo, escopo, regras de negócio, restrições, critérios de sucesso, áreas e glossário. Entra em **todas** as respostas dos agentes.
- **Área de cada pessoa**: Desenvolvimento, Engenharia de dados, Análise de dados, Jurídico, Compliance, Risco, Negócio, Produto. A IA adapta o foco da resposta à área.
- **Fontes por área**: uma fonte pode ser restrita a áreas (ex.: parecer jurídico só para Jurídico/Compliance/Risco). Aplicado no banco, inclusive na busca da IA.
- **Agentes por área**: ex.: "Jurídico & Privacidade" e "Compliance & Risco" só aparecem para essas áreas.

## Perfis
| Perfil | Pode |
|---|---|
| Proprietário/Admin da organização | Criar projetos; age como admin em todos os projetos da organização |
| Admin do projeto | Gerenciar membros, agentes, fontes, escopo de externos |
| Colaborador | Consultar e incluir/reprocessar conhecimento |
| Leitor | Apenas consultar |
| Externo | Colaborador ou leitor limitado às fontes liberadas |

## Critérios de aceite: como validar
1. **Login:** crie a conta, confirme o e-mail e entre.
2. **Projeto:** em Projetos → Novo projeto, crie e depois troque de projeto pelo seletor do topo.
3. **Membro:** em Equipe → Convidar, o convite chega por e-mail.
4. **Upload:** em Base → Adicionar → Arquivo, envie um PDF; o status vira **Indexado** com N trechos.
5. **RAG:** no Chat, pergunte sobre o PDF; a resposta cita **[1]** e mostra fonte, trecho e % de relevância.
6. **Histórico:** recarregue a página; a conversa continua na lateral (ou no botão Histórico no celular).
7. **Isolamento:** um segundo usuário de outra empresa não vê nada (coberto também por `npm run test:db`).
8. **Terceiro:** convide marcando "externo" e libere uma fonte em Escopo; ele só vê essa fonte e as respostas só a usam.
9. **Mobile:** abra no celular para ver o menu inferior, os cards horizontais, o chat em tela cheia e os formulários em bottom sheet.

## Próximos passos (roadmap)
- Indexação assíncrona em fila (Supabase Queues/Inngest) para arquivos grandes
- Streaming das respostas
- SSO Microsoft Entra ID
- Adaptadores GitHub, Azure DevOps, SharePoint e Fabric (contrato em `services/integrations`)
- OCR e descrição automática de imagens e diagramas por modelo de visão
- Planos e cobrança (Stripe) usando `organizations.plan`
