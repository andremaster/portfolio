import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getAIForOrg, AIConfigError, AIProviderError, type ChatMessage } from "@/services/ai/provider";
import { resolveChatAI, AILimitError, type ChatAI } from "@/services/ai/billing";
import { briefToText, buildSystemPrompt, NO_CONTEXT_ANSWER, type RetrievedChunk } from "@/services/rag/prompt";
import type { MemberFunction } from "@/lib/functions";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  projectId: z.string().uuid(),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  message: z.string().trim().min(1).max(4000),
});

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, "Sessão expirada. Entre novamente.");

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Requisição inválida.");
  const { projectId, agentId, message } = parsed.data;
  let conversationId = parsed.data.conversationId ?? null;

  // RLS: só retorna o agente se o usuário for membro do projeto e o agente permitir o perfil dele
  const { data: agent } = await supabase.from("agents")
    .select("id, name, system_prompt, knowledge_scope, model, temperature, is_active, project:projects(id, name, organization_id)")
    .eq("id", agentId).eq("project_id", projectId).single();
  if (!agent) return fail(403, "Agente não encontrado ou sem permissão.");
  if (!agent.is_active) return fail(409, "Este agente está desativado.");
  const project = agent.project as unknown as { id: string; name: string; organization_id: string };

  const [{ data: used }, { data: brief }, { data: fn }, { data: isExternal }] = await Promise.all([
    supabase.rpc("my_questions_today"),
    supabase.from("project_briefs").select("objective, scope, business_rules, restrictions, success_criteria, glossary, stakeholders").eq("project_id", projectId).maybeSingle(),
    supabase.rpc("project_function_of", { p_project: projectId }),
    supabase.rpc("is_project_external", { p_project: projectId }),
  ]);
  if ((used ?? 0) >= env.chatDailyLimit()) return fail(429, "Limite diário de perguntas atingido.");

  // Conversa
  if (conversationId) {
    const { data: conv } = await supabase.from("conversations").select("id, agent_id").eq("id", conversationId).eq("project_id", projectId).single();
    if (!conv) return fail(404, "Conversa não encontrada.");
  } else {
    const { data: conv, error } = await supabase.from("conversations")
      .insert({ project_id: projectId, agent_id: agentId, user_id: user.id, title: message.slice(0, 80) })
      .select("id").single();
    if (error || !conv) return fail(500, "Não foi possível criar a conversa.");
    conversationId = conv.id;
  }

  const { data: history } = await supabase.from("messages").select("role, content")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(8);

  // Quem paga esta resposta (regra do projeto) — decidido antes de gravar a pergunta
  // Sem IA disponível (empresa não conectou), o chat funciona em "modo busca": mostra os trechos.
  let chatAI: ChatAI | null = null;
  let noAIReason = "";
  try {
    chatAI = await resolveChatAI(supabase, { projectId, orgId: project.organization_id, userId: user.id, isExternal: Boolean(isExternal) });
  } catch (e) {
    if (e instanceof AILimitError) return fail(429, e.message);
    if (e instanceof AIConfigError) noAIReason = e.message;
    else throw e;
  }

  const { error: userMsgErr } = await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: message });
  if (userMsgErr) return fail(500, "Não foi possível salvar a pergunta.");

  try {
    // Busca: textual (grátis, sempre) + vetores da IA da empresa dona, se houver
    let embedding: number[] | null = null;
    try { [embedding] = await (await getAIForOrg(project.organization_id)).embed([message]); }
    catch (e) { if (!(e instanceof AIConfigError || e instanceof AIProviderError)) throw e; }

    // Cliente do usuário: filtros de projeto + RLS de fontes
    const { data: matches, error: matchErr } = await supabase.rpc("search_chunks", {
      p_project: projectId,
      p_query: message,
      p_embedding: embedding ? JSON.stringify(embedding) : null,
      p_count: 6,
      p_categories: agent.knowledge_scope ?? [],
    });
    if (matchErr) throw new Error(matchErr.message);
    const chunks = (matches ?? []) as RetrievedChunk[];

    let content = NO_CONTEXT_ANSWER;
    let model: string | null = null;
    let tokensIn = 0, tokensOut = 0;

    // Com ficha preenchida a IA pode responder sobre objetivo/regras mesmo sem trechos
    if (!chatAI) {
      const list = chunks.map((c, i) => `[${i + 1}] ${c.source_name}\n${c.content.slice(0, 700)}`).join("\n\n");
      content = chunks.length
        ? `Modo busca (sem IA conectada neste projeto): estes são os trechos mais relevantes dos documentos.\n\n${list}\n\n${noAIReason} Ou use o Nexo pelo conector dentro do seu Claude/ChatGPT.`
        : `Não encontrei nada nos documentos sobre isso. ${noAIReason}`;
    } else if (chunks.length > 0 || briefToText(brief)) {
      const ai = chatAI.ai;
      const msgs: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt(agent, project.name, chunks, { brief, fn: fn as MemberFunction | null, isExternal: Boolean(isExternal) }) },
        ...((history ?? []).reverse().filter((m) => m.role !== "system") as ChatMessage[]),
        { role: "user", content: message },
      ];
      const r = await ai.chat(msgs, { model: chatAI.useAgentModel ? agent.model : null, temperature: Number(agent.temperature) });
      ({ content, model, tokensIn, tokensOut } = r);
    }

    const { data: saved, error: saveErr } = await supabase.from("messages")
      .insert({ conversation_id: conversationId, role: "assistant", content, model, tokens_input: tokensIn, tokens_output: tokensOut,
        billed_to: model && chatAI ? chatAI.billedTo : null, ai_label: model && chatAI ? chatAI.label : null })
      .select("id, role, content, created_at").single();
    if (saveErr || !saved) throw new Error(saveErr?.message ?? "save failed");

    const sources = chunks.map((c) => ({
      message_id: saved.id, source_id: c.source_id, chunk_id: c.chunk_id,
      similarity: c.similarity, excerpt: c.content.slice(0, 600),
    }));
    if (sources.length) await supabase.from("message_sources").insert(sources);
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    await supabase.from("audit_logs").insert({
      organization_id: project.organization_id, project_id: projectId, user_id: user.id,
      action: "query", entity_type: "agent", entity_id: agentId,
      metadata: { conversation_id: conversationId, sources: chunks.length, tokens_in: tokensIn, tokens_out: tokensOut },
    });

    return NextResponse.json({
      conversationId,
      message: {
        ...saved,
        sources: [
          ...(model && briefToText(brief) ? [{ source_id: "brief", source_name: "Ficha do projeto", similarity: 1, excerpt: (brief?.objective ?? "").slice(0, 400) }] : []),
          ...chunks.map((c) => ({ source_id: c.source_id, source_name: c.source_name, similarity: c.similarity, excerpt: c.content.slice(0, 600) })),
        ],
      },
    });
  } catch (e) {
    console.error("[chat]", e);
    if (e instanceof AIConfigError) return fail(503, e.message);
    if (e instanceof AIProviderError) return fail(502, e.message);
    return fail(502, "O agente não conseguiu responder agora. Tente novamente.");
  }
}
