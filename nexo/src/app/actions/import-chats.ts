"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { createDraft } from "@/services/handoff";
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
      // Sem IA no Nexo: importa a conversa completa (o resumo pode ser feito depois pelo conector, na IA do usuário)
      if (!(e instanceof AILimitError || e instanceof AIConfigError)) return { error: "IA indisponível para gerar os resumos." };
    }
  }

  const results: string[] = [];
  for (const it of items) {
    const title = String(it.title ?? "").slice(0, 120) || "Conversa";
    const text = String(it.text ?? "").slice(0, 400_000);
    if (!text.trim()) continue;
    const origin = it.source === "claude" ? "claude" : "chatgpt";
    let summary = "";
    if (mode !== "completo" && chatAI) {
      try {
        const r = await chatAI.ai.chat([
          { role: "system", content: "Você gera handoffs fiéis. Use só o que está na conversa; escreva 'não informado' quando faltar algo. Nunca inclua senhas, chaves ou dados pessoais." },
          { role: "user", content: `${handoffPrompt(ctx.project.name)}\n\n--- CONVERSA (${origin}) ---\n${text.slice(0, 60_000)}` },
        ], { temperature: 0.1 });
        summary = r.content;
      } catch (e) {
        results.push(`“${title}”: resumo não gerado (${e instanceof AIProviderError ? e.message : "falha ao resumir"})`);
      }
    }
    // Tudo entra como RASCUNHO para aprovação do administrador (vira fonte só depois)
    try {
      const d = await createDraft(ctx.supabase, {
        projectId: ctx.project.id, authorId: ctx.user.id, title, contentMd: summary,
        transcript: mode !== "resumo" || !summary ? text : null, source: "import", origin,
      });
      results.push(`“${title}”: rascunho v${d.version_no}`);
    } catch {
      results.push(`“${title}”: erro ao salvar`);
    }
  }
  revalidatePath("/handoff");
  return { ok: `${results.join(" · ")}. Revise e aprove em “Handoffs”.` };
}
