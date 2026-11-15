"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { indexSource } from "@/services/rag/indexer";
import { resolveChatAI, AILimitError } from "@/services/ai/billing";
import { AIConfigError, AIProviderError } from "@/services/ai/provider";
import { handoffPrompt } from "@/lib/handoff";

type Item = { title: string; date: string | null; text: string; source: "chatgpt" | "claude" };

/**
 * Importa conversas escolhidas do arquivo de exportação: completas, resumidas (handoff .md
 * gerado pela IA que paga neste projeto) ou as duas.
 */
export async function importExportedChats(items: Item[], mode: "completo" | "resumo" | "ambos"): Promise<{ ok?: string; error?: string }> {
  const ctx = await getContext();
  if (!ctx.org || !ctx.project) return { error: "Selecione um projeto." };
  if (!ctx.canWrite) return { error: "Seu perfil permite apenas consulta." };
  if (!Array.isArray(items) || !items.length) return { error: "Escolha pelo menos uma conversa." };
  if (items.length > 20) return { error: "Importe até 20 conversas por vez." };

  let chatAI: Awaited<ReturnType<typeof resolveChatAI>> | null = null;
  if (mode !== "completo") {
    try {
      chatAI = await resolveChatAI(ctx.supabase, { projectId: ctx.project.id, orgId: ctx.org.id, userId: ctx.user.id, isExternal: ctx.isExternal });
    } catch (e) {
      return { error: e instanceof AILimitError || e instanceof AIConfigError ? e.message : "IA indisponível para gerar os resumos." };
    }
  }

  const results: string[] = [];
  for (const it of items) {
    const title = String(it.title ?? "").slice(0, 120) || "Conversa";
    const text = String(it.text ?? "").slice(0, 400_000);
    if (!text.trim()) continue;
    const origin = it.source === "claude" ? "claude" : "chatgpt";
    const save = async (name: string, category: string, body: string) => {
      const { data: src, error } = await ctx.supabase.from("knowledge_sources").insert({
        project_id: ctx.project!.id, name, source_type: "text", category, raw_text: body, origin, created_by: ctx.user.id,
      }).select("id").single();
      if (error || !src) return "erro ao salvar";
      const r = await indexSource(ctx.supabase, src.id);
      return r.ok ? `${r.chunks} trechos` : r.error;
    };

    if (mode !== "resumo") results.push(`“${title}” completa: ${await save(`Conversa: ${title}`, "conversas", text)}`);
    if (mode !== "completo" && chatAI) {
      try {
        const r = await chatAI.ai.chat([
          { role: "system", content: "Você gera handoffs fiéis. Use só o que está na conversa; escreva 'não informado' quando faltar algo. Nunca inclua senhas, chaves ou dados pessoais." },
          { role: "user", content: `${handoffPrompt(ctx.project.name)}\n\n--- CONVERSA (${origin}) ---\n${text.slice(0, 60_000)}` },
        ], { temperature: 0.1 });
        results.push(`“${title}” resumo: ${await save(`Resumo: ${title}`, "handoff", r.content)}`);
      } catch (e) {
        results.push(`“${title}” resumo: ${e instanceof AIProviderError ? e.message : "falha ao resumir"}`);
      }
    }
  }
  revalidatePath("/knowledge");
  revalidatePath("/dashboard");
  return { ok: results.join(" · ") };
}
