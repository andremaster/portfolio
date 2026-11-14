import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getAI, AIConfigError, type ChatMessage } from "@/services/ai/provider";
import { buildSystemPrompt, NO_CONTEXT_ANSWER, type RetrievedChunk } from "@/services/rag/prompt";

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

  const { data: used } = await supabase.rpc("my_questions_today");
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

  const { error: userMsgErr } = await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: message });
  if (userMsgErr) return fail(500, "Não foi possível salvar a pergunta.");

  try {
    const ai = getAI();
    const [embedding] = await ai.embed([message]);

    // Busca vetorial com o cliente do usuário: filtros de projeto + RLS de fontes
    const { data: matches, error: matchErr } = await supabase.rpc("match_chunks", {
      p_project: projectId,
      p_embedding: JSON.stringify(embedding),
      p_count: 6,
      p_categories: agent.knowledge_scope ?? [],
    });
    if (matchErr) throw new Error(matchErr.message);
    const chunks = (matches ?? []) as RetrievedChunk[];

    let content = NO_CONTEXT_ANSWER;
    let model: string | null = null;
    let tokensIn = 0, tokensOut = 0;

    if (chunks.length > 0) {
      const msgs: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt(agent, project.name, chunks) },
        ...((history ?? []).reverse().filter((m) => m.role !== "system") as ChatMessage[]),
        { role: "user", content: message },
      ];
      const r = await ai.chat(msgs, { model: agent.model, temperature: Number(agent.temperature) });
      ({ content, model, tokensIn, tokensOut } = r);
    }

    const { data: saved, error: saveErr } = await supabase.from("messages")
      .insert({ conversation_id: conversationId, role: "assistant", content, model, tokens_input: tokensIn, tokens_output: tokensOut })
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
      message: { ...saved, sources: chunks.map((c) => ({ source_id: c.source_id, source_name: c.source_name, similarity: c.similarity, excerpt: c.content.slice(0, 600) })) },
    });
  } catch (e) {
    console.error("[chat]", e);
    if (e instanceof AIConfigError) return fail(503, "A IA ainda não foi configurada pelo administrador.");
    return fail(502, "O agente não conseguiu responder agora. Tente novamente.");
  }
}
