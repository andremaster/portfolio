import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIConfigError, buildAI, getAIForOrg, loadUserConnection, type AIProvider } from "./provider";

export type BillingMode = "owner" | "member" | "mixed";
export const billingLabel: Record<BillingMode, string> = {
  owner: "A empresa dona do projeto paga",
  member: "Cada participante paga com a própria IA",
  mixed: "Empresa dona por padrão; quem quiser usa a própria IA",
};

export class AILimitError extends Error {}

export type ChatAI = { ai: AIProvider; billedTo: "owner" | "member"; label: string; useAgentModel: boolean };

/**
 * Decide qual IA responde a pergunta e quem paga, conforme a regra do projeto:
 * - owner: IA da empresa dona (com limite mensal por pessoa, se houver)
 * - member: IA conectada pelo participante para este projeto
 * - mixed: a do participante se ele escolheu uma; senão a da empresa dona (com limite)
 */
export async function resolveChatAI(userClient: SupabaseClient, args: { projectId: string; orgId: string; userId: string; isExternal: boolean }): Promise<ChatAI> {
  const [{ data: settings }, { data: choice }] = await Promise.all([
    userClient.from("project_ai_settings").select("billing_mode, monthly_limit_member, monthly_limit_external").eq("project_id", args.projectId).maybeSingle(),
    userClient.from("project_member_ai").select("connection_id").eq("project_id", args.projectId).eq("user_id", args.userId).maybeSingle(),
  ]);
  const mode = (settings?.billing_mode ?? "owner") as BillingMode;
  const connId = (choice?.connection_id as string | null) ?? null;

  const memberAI = async (): Promise<ChatAI> => {
    if (!connId) throw new AIConfigError("Neste projeto cada participante usa a própria IA. Conecte a sua em “Minhas IAs” e escolha-a para este projeto.");
    const conn = await loadUserConnection(connId, args.userId);
    if (!conn) throw new AIConfigError("A IA escolhida para este projeto não existe mais. Escolha outra em “Minhas IAs”.");
    return { ai: buildAI({ chat: conn.chat, embed: null }, false), billedTo: "member", label: conn.label, useAgentModel: false };
  };

  if (mode === "member" || (mode === "mixed" && connId)) return memberAI();

  const limit = args.isExternal ? settings?.monthly_limit_external : settings?.monthly_limit_member;
  if (limit !== null && limit !== undefined) {
    const { data: used } = await userClient.rpc("my_owner_billed_this_month", { p_project: args.projectId });
    if ((used ?? 0) >= limit) {
      throw new AILimitError(mode === "mixed"
        ? `Você usou as ${limit} perguntas do mês pagas pela empresa dona. Conecte a sua IA em “Minhas IAs” para continuar.`
        : `Você atingiu o limite de ${limit} perguntas neste mês definido pela empresa dona do projeto.`);
    }
  }
  return { ai: await getAIForOrg(args.orgId), billedTo: "owner", label: "IA da empresa dona", useAgentModel: true };
}
