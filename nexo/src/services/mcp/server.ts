import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAIForOrg, AIConfigError, AIProviderError } from "@/services/ai/provider";
import { approveDraft, createDraft } from "@/services/handoff";
import { handoffPrompt, HANDOFF_SECTIONS } from "@/lib/handoff";
import { sourceLabel } from "@/components/icons";

/**
 * Conector MCP do Nexo (Streamable HTTP, sem estado, respostas JSON).
 * Endereço pessoal: /api/mcp/<token>. Tudo roda com as permissões do dono do token.
 */

const PROTOCOL = "2025-06-18";
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
type Admin = ReturnType<typeof createAdminClient>;
type Proj = { id: string; name: string; organization: string; role: string | null; is_external: boolean };

const ORIGINS = ["chatgpt", "claude", "gemini", "copilot", "outra"];

const TOOLS = [
  {
    name: "listar_projetos",
    description: "Lista os projetos do Nexo que o usuário pode acessar (com empresa e permissão). Use primeiro para descobrir o nome/id do projeto.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ficha_do_projeto",
    description: "Traz o contexto-base do projeto no Nexo: objetivo, escopo, regras de negócio, restrições, critérios de sucesso, envolvidos, glossário e a lista de fontes de conhecimento. Use para dar contexto a esta conversa.",
    inputSchema: { type: "object", properties: { projeto: { type: "string", description: "Nome ou id do projeto" } }, required: ["projeto"], additionalProperties: false },
  },
  {
    name: "buscar_contexto",
    description: "Busca nos documentos do projeto (RAG) os trechos mais relevantes para uma pergunta, respeitando as permissões do usuário. Responda citando as fontes retornadas; se nada for encontrado, diga que o Nexo não tem essa informação.",
    inputSchema: {
      type: "object",
      properties: {
        projeto: { type: "string", description: "Nome ou id do projeto" },
        pergunta: { type: "string", description: "O que procurar, em linguagem natural" },
        quantidade: { type: "integer", minimum: 1, maximum: 12, description: "Número de trechos (padrão 6)" },
      },
      required: ["projeto", "pergunta"], additionalProperties: false,
    },
  },
  {
    name: "modelo_de_handoff",
    description: "Retorna o formato de handoff (resumo .md) que o Nexo entende. Use antes de importar um resumo desta conversa ou deste projeto.",
    inputSchema: { type: "object", properties: { projeto: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "importar_para_o_nexo",
    description: "Envia ESTA conversa (ou o projeto atual da IA) para um projeto do Nexo como RASCUNHO, que o administrador do projeto aprova antes de virar contexto oficial. ANTES de chamar, pergunte ao usuário o que enviar: (1) o resumo em .md no formato de modelo_de_handoff, (2) a conversa completa, ou (3) os dois. Nunca inclua senhas, chaves ou dados pessoais sensíveis.",
    inputSchema: {
      type: "object",
      properties: {
        projeto: { type: "string", description: "Nome ou id do projeto de destino" },
        titulo: { type: "string", description: "Título curto, ex.: 'Decisões da API de pagamentos'" },
        resumo_md: { type: "string", description: "Handoff em Markdown com os títulos ## do modelo_de_handoff" },
        conversa_completa: { type: "string", description: "Transcrição da conversa (Usuário: … / IA: …)" },
        origem: { type: "string", enum: ORIGINS, description: "De qual IA vem o conteúdo" },
        preencher_ficha: { type: "boolean", description: "Ao aprovar, preencher campos vazios da ficha com o resumo" },
        aprovar_agora: { type: "boolean", description: "Só administradores: aprovar na hora (sem revisão)" },
      },
      required: ["projeto", "titulo"], additionalProperties: false,
    },
  },
  {
    name: "handoff_atual",
    description: "Mostra a versão vigente (aprovada) do handoff do projeto, com o id da versão. Use antes de atualizar_handoff.",
    inputSchema: { type: "object", properties: { projeto: { type: "string" } }, required: ["projeto"], additionalProperties: false },
  },
  {
    name: "atualizar_handoff",
    description: "Envia uma NOVA VERSÃO do handoff do projeto (rascunho para aprovação). Passo a passo: chame handoff_atual, revise o texto com o que mudou nesta conversa (decisões, estado atual, próximos passos, pendências), mostre ao usuário e envie com versao_base_id = id da versão vigente. Se o handoff vigente mudou nesse meio-tempo, retorna conflito.",
    inputSchema: {
      type: "object",
      properties: {
        projeto: { type: "string" },
        resumo_md: { type: "string", description: "Handoff completo revisado, em Markdown com os títulos ##" },
        versao_base_id: { type: "string", description: "id da versão vigente retornado por handoff_atual (vazio se for o primeiro)" },
        titulo: { type: "string", description: "Ex.: 'Atualização de 15/11 — API de pagamentos'" },
        origem: { type: "string", enum: ORIGINS },
        aprovar_agora: { type: "boolean", description: "Só administradores: aprovar na hora" },
      },
      required: ["projeto", "resumo_md"], additionalProperties: false,
    },
  },
];

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

async function userFromToken(admin: Admin, token: string) {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await admin.from("mcp_tokens").select("id, user_id, revoked").eq("token_hash", hash).maybeSingle();
  if (!data || data.revoked) return null;
  await admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.user_id as string;
}

async function findProject(admin: Admin, userId: string, ref: unknown): Promise<Proj | string> {
  const { data } = await admin.rpc("mcp_projects", { p_user: userId });
  const list = (data ?? []) as Proj[];
  if (!list.length) return "Você ainda não participa de nenhum projeto no Nexo.";
  const r = String(ref ?? "").trim().toLowerCase();
  const hit = list.find((p) => p.id === r) ?? list.find((p) => p.name.toLowerCase() === r) ?? list.find((p) => p.name.toLowerCase().includes(r));
  return hit ?? `Projeto "${ref}" não encontrado. Projetos disponíveis: ${list.map((p) => p.name).join(", ")}.`;
}

async function callTool(admin: Admin, userId: string, name: string, args: Record<string, unknown>) {
  if (name === "listar_projetos") {
    const { data } = await admin.rpc("mcp_projects", { p_user: userId });
    const list = (data ?? []) as Proj[];
    if (!list.length) return text("Você ainda não participa de nenhum projeto no Nexo.");
    return text(list.map((p) => `- ${p.name} — ${p.organization} · ${p.role ?? "membro"}${p.is_external ? " · terceiro" : ""} (id: ${p.id})`).join("\n"));
  }

  if (name === "modelo_de_handoff") {
    const p = args.projeto ? await findProject(admin, userId, args.projeto) : null;
    return text(handoffPrompt(p && typeof p !== "string" ? p.name : undefined));
  }

  const proj = await findProject(admin, userId, args.projeto);
  if (typeof proj === "string") return text(proj, true);

  if (name === "ficha_do_projeto") {
    const { data } = await admin.rpc("mcp_brief", { p_user: userId, p_project: proj.id });
    const v = data as { project: { name: string; description: string | null }; brief: Record<string, string | null> | null; sources: { name: string; type: string; category: string; status: string }[] } | null;
    if (!v) return text("Sem acesso a este projeto.", true);
    const out = [`# ${v.project.name}`, v.project.description ?? ""];
    for (const [k, t] of HANDOFF_SECTIONS) if (v.brief?.[k]) out.push(`## ${t}`, String(v.brief[k]));
    if (!v.brief) out.push("_A ficha do projeto ainda não foi preenchida._");
    out.push("## Fontes de conhecimento", ...(v.sources.length ? v.sources.map((s) => `- ${s.name} — ${sourceLabel[s.type] ?? s.type} · ${s.category}${s.status !== "indexed" ? ` (${s.status})` : ""}`) : ["(nenhuma)"]));
    await audit(admin, userId, proj, "mcp_brief");
    return text(out.filter(Boolean).join("\n\n"));
  }

  if (name === "buscar_contexto") {
    const q = String(args.pergunta ?? "").trim().slice(0, 2000);
    if (!q) return text("Informe a pergunta.", true);
    const { data: p } = await admin.from("projects").select("organization_id").eq("id", proj.id).single();
    try {
      // Vetores são opcionais (IA da empresa); a busca textual funciona sempre, sem custo.
      let emb: number[] | null = null;
      try { [emb] = await (await getAIForOrg(p!.organization_id)).embed([q]); }
      catch (e) { if (!(e instanceof AIConfigError || e instanceof AIProviderError)) throw e; }
      const k = Math.min(Math.max(Number(args.quantidade) || 8, 1), 20);
      const { data, error } = await admin.rpc("mcp_search", { p_user: userId, p_project: proj.id, p_query: q, p_embedding: emb ? JSON.stringify(emb) : null, p_count: k });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { source_name: string; category: string; content: string; similarity: number }[];
      await audit(admin, userId, proj, "mcp_search", { results: rows.length });
      if (!rows.length) return text(`Nada encontrado no projeto "${proj.name}" para: ${q}`);
      return text(rows.map((r, i) => `[${i + 1}] ${r.source_name} (${r.category})${r.similarity ? ` · relevância ${Math.round(r.similarity * 100)}%` : ""}\n${r.content}`).join("\n\n---\n\n")
        + "\n\nCite as fontes pelo número [n] ao responder.");
    } catch (e) {
      return text(e instanceof AIConfigError || e instanceof AIProviderError ? e.message : "Falha na busca. Tente novamente.", true);
    }
  }

  if (name === "handoff_atual") {
    const { data } = await admin.rpc("mcp_handoff_current", { p_user: userId, p_project: proj.id });
    const h = data as { id?: string; version_no?: number; title?: string; content_md?: string; approved_at?: string } | null;
    if (!h?.id) return text(`O projeto "${proj.name}" ainda não tem handoff aprovado. Para criar o primeiro, use modelo_de_handoff e depois atualizar_handoff.`);
    return text(`Handoff vigente de "${proj.name}" — versão ${h.version_no} (id: ${h.id}), aprovada em ${h.approved_at ? new Date(h.approved_at).toLocaleString("pt-BR") : "—"}.\n\n${h.content_md}\n\nPara atualizar, envie a versão revisada com atualizar_handoff informando versao_base_id = ${h.id}.`);
  }

  if (name === "importar_para_o_nexo" || name === "atualizar_handoff") {
    const { data: perms } = await admin.rpc("mcp_perms", { p_user: userId, p_project: proj.id });
    const pm = perms as { write: boolean; manage: boolean } | null;
    if (!pm?.write) return text("Seu perfil neste projeto só permite consulta; peça permissão de colaborador para enviar handoffs.", true);
    const isUpdate = name === "atualizar_handoff";
    const title = String(args.titulo ?? (isUpdate ? "Atualização do handoff" : "")).trim().slice(0, 150) || "Conversa importada";
    const resumo = typeof args.resumo_md === "string" ? args.resumo_md.trim() : "";
    const completa = typeof args.conversa_completa === "string" ? args.conversa_completa.trim() : "";
    if (!resumo && !completa) return text(isUpdate ? "Envie o resumo_md atualizado." : "Envie o resumo_md, a conversa_completa ou os dois.", true);
    if (resumo.length > 200_000 || completa.length > 400_000) return text("Conteúdo grande demais (resumo até 200 mil e conversa até 400 mil caracteres).", true);
    const origin = ORIGINS.includes(String(args.origem)) ? String(args.origem) : "outra";

    // Conflito: a atualização foi feita em cima de uma versão que já não é a vigente
    const { data: cur } = await admin.from("projects").select("current_handoff_id").eq("id", proj.id).single();
    const currentId = (cur?.current_handoff_id as string | null) ?? null;
    const baseId = typeof args.versao_base_id === "string" ? args.versao_base_id : (isUpdate ? null : currentId);
    if (isUpdate && currentId && baseId !== currentId)
      return text(`Conflito: o handoff vigente mudou (versão atual id ${currentId}). Chame handoff_atual, incorpore as mudanças e envie de novo com versao_base_id = ${currentId}.`, true);

    try {
      const d = await createDraft(admin, {
        projectId: proj.id, authorId: userId, title, contentMd: resumo, transcript: completa || null,
        source: "mcp", origin, fillBrief: Boolean(args.preencher_ficha), baseVersionId: baseId,
      });
      await audit(admin, userId, proj, isUpdate ? "mcp_update_handoff" : "mcp_import", { title, origin, version: d.version_no });
      if (args.aprovar_agora && pm.manage) {
        const r = await approveDraft(d.id, userId, { fillBrief: Boolean(args.preencher_ficha) });
        return text(`Versão ${r.version} criada e aprovada (você é administrador) em "${proj.name}": ${r.summary}.`);
      }
      return text(`Enviado para "${proj.name}" como RASCUNHO v${d.version_no}. ${pm.manage ? "Revise e aprove no Nexo → Handoffs (ou chame de novo com aprovar_agora = true)." : "O administrador do projeto vai revisar e aprovar; só depois vira contexto oficial."}`);
    } catch (e) {
      console.error("[mcp] draft", e);
      return text("Não foi possível salvar no Nexo.", true);
    }
  }

  return text(`Ferramenta desconhecida: ${name}`, true);
}

async function audit(admin: Admin, userId: string, proj: Proj, action: string, meta: Record<string, unknown> = {}) {
  const { data: p } = await admin.from("projects").select("organization_id").eq("id", proj.id).single();
  await admin.from("audit_logs").insert({ organization_id: p?.organization_id, project_id: proj.id, user_id: userId, action, entity_type: "mcp", metadata: meta });
}

async function handle(admin: Admin, userId: string, msg: Rpc) {
  switch (msg.method) {
    case "initialize": {
      const v = String((msg.params?.protocolVersion as string) ?? PROTOCOL);
      return ok(msg.id, {
        protocolVersion: v, capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nexo", title: "Nexo · contexto de projetos", version: "1.0.0" },
        instructions: "Nexo é o hub de contexto dos projetos do usuário. Use listar_projetos, ficha_do_projeto e buscar_contexto para responder com base no projeto. Para levar esta conversa ao Nexo use importar_para_o_nexo (após perguntar: resumo, conversa completa ou os dois); para manter o handoff do projeto em dia use handoff_atual e atualizar_handoff. Envios viram rascunho para aprovação do administrador.",
      });
    }
    case "ping": return ok(msg.id, {});
    case "tools/list": return ok(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try { return ok(msg.id, await callTool(admin, userId, name, args)); }
      catch (e) { console.error("[mcp]", name, e); return ok(msg.id, text("Erro interno no Nexo.", true)); }
    }
    case "resources/list": return ok(msg.id, { resources: [] });
    case "prompts/list": return ok(msg.id, { prompts: [] });
    default: return err(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}

/** Atende uma requisição MCP com o token (vindo do endereço ou do cabeçalho Authorization). */
export async function mcpPost(req: Request, token: string | null) {
  const admin = createAdminClient();
  const userId = token ? await userFromToken(admin, token) : null;
  if (!userId) return NextResponse.json(err(null, -32001, "Conector inválido ou revogado. Gere um novo em Nexo → Minhas IAs e envie a chave no cabeçalho Authorization: Bearer <chave>."), { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json(err(null, -32700, "JSON inválido."), { status: 400 });
  const batch = Array.isArray(body) ? (body as Rpc[]) : [body as Rpc];
  const out = [];
  for (const m of batch) {
    if (m.id === undefined || m.id === null) continue; // notificação: sem resposta
    out.push(await handle(admin, userId, m));
  }
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { "Cache-Control": "no-store" } });
}

export function mcpGet() {
  return new NextResponse("Este endereço é um conector MCP (use POST).", { status: 405, headers: { Allow: "POST" } });
}

/** Lê a chave do cabeçalho Authorization: Bearer <chave> (ou X-Nexo-Key). */
export function tokenFromHeaders(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? req.headers.get("x-nexo-key") ?? "").trim() || null;
}
