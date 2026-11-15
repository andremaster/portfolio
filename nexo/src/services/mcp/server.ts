import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAIForOrg, AIConfigError, AIProviderError } from "@/services/ai/provider";
import { indexSource } from "@/services/rag/indexer";
import { handoffPrompt, parseHandoff, HANDOFF_SECTIONS } from "@/lib/handoff";
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
    description: "Importa ESTA conversa (ou o projeto atual da IA) para um projeto do Nexo. ANTES de chamar, pergunte ao usuário o que importar: (1) o resumo em .md no formato de modelo_de_handoff, (2) a conversa completa, ou (3) os dois. Nunca inclua senhas, chaves ou dados pessoais sensíveis. O conteúdo vira fonte indexada; o resumo pode preencher a ficha do projeto (só campos vazios).",
    inputSchema: {
      type: "object",
      properties: {
        projeto: { type: "string", description: "Nome ou id do projeto de destino" },
        titulo: { type: "string", description: "Título curto, ex.: 'Decisões da API de pagamentos'" },
        resumo_md: { type: "string", description: "Handoff em Markdown com os títulos ## do modelo_de_handoff" },
        conversa_completa: { type: "string", description: "Transcrição da conversa (Usuário: … / IA: …)" },
        origem: { type: "string", enum: ORIGINS, description: "De qual IA vem o conteúdo" },
        preencher_ficha: { type: "boolean", description: "Preencher campos vazios da ficha com o resumo (só administradores)" },
      },
      required: ["projeto", "titulo"], additionalProperties: false,
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

  if (name === "importar_para_o_nexo") {
    const { data: perms } = await admin.rpc("mcp_perms", { p_user: userId, p_project: proj.id });
    const pm = perms as { write: boolean; manage: boolean } | null;
    if (!pm?.write) return text("Seu perfil neste projeto só permite consulta; peça permissão de colaborador para importar.", true);
    const title = String(args.titulo ?? "").trim().slice(0, 150) || "Conversa importada";
    const resumo = typeof args.resumo_md === "string" ? args.resumo_md.trim() : "";
    const completa = typeof args.conversa_completa === "string" ? args.conversa_completa.trim() : "";
    if (!resumo && !completa) return text("Envie o resumo_md, a conversa_completa ou os dois.", true);
    if (resumo.length > 200_000 || completa.length > 400_000) return text("Conteúdo grande demais (resumo até 200 mil e conversa até 400 mil caracteres).", true);
    const origin = ORIGINS.includes(String(args.origem)) ? String(args.origem) : "outra";
    const done: string[] = [];
    for (const [kind, body] of [["resumo", resumo], ["conversa", completa]] as const) {
      if (!body) continue;
      const { data: src, error } = await admin.from("knowledge_sources").insert({
        project_id: proj.id, name: `${kind === "resumo" ? "Resumo" : "Conversa"}: ${title}`, source_type: "text",
        category: kind === "resumo" ? "handoff" : "conversas", raw_text: body, origin, created_by: userId,
      }).select("id").single();
      if (error || !src) return text("Não foi possível salvar no Nexo.", true);
      const r = await indexSource("trusted", src.id);
      done.push(r.ok ? `${kind === "resumo" ? "resumo indexado" : "conversa indexada"} em ${r.chunks} trechos` : `${kind === "resumo" ? "resumo salvo" : "conversa salva"}, mas a indexação falhou: ${r.error}`);
    }
    if (resumo && args.preencher_ficha && pm.manage) {
      const parsed = parseHandoff(resumo);
      const { data: brief } = await admin.from("project_briefs").select("*").eq("project_id", proj.id).maybeSingle();
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) if (v && !(brief as Record<string, unknown> | null)?.[k]) patch[k] = v;
      if (Object.keys(patch).length) {
        await admin.from("project_briefs").upsert({ ...patch, project_id: proj.id, updated_by: userId }, { onConflict: "project_id" });
        done.push(`ficha: ${Object.keys(patch).length} campo(s) preenchido(s)`);
      }
    }
    await audit(admin, userId, proj, "mcp_import", { title, origin });
    return text(`Importado para "${proj.name}": ${done.join("; ")}.`);
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
        instructions: "Nexo é o hub de contexto dos projetos do usuário. Use listar_projetos, ficha_do_projeto e buscar_contexto para responder com base no projeto, e importar_para_o_nexo (após perguntar ao usuário: resumo, conversa completa ou os dois) para salvar esta conversa no projeto.",
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
