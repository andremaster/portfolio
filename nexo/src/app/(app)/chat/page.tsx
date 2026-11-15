import { requireOrg } from "@/lib/context";
import { NoProject, Empty } from "@/components/empty";
import { ChatView, type UIMessage } from "./client";

export const metadata = { title: "Chat" };

export default async function Chat({ searchParams }: { searchParams: Promise<{ c?: string; agent?: string }> }) {
  const ctx = await requireOrg();
  if (!ctx.project) return <NoProject />;
  const sp = await searchParams;

  const [{ data: agents }, { data: conversations }] = await Promise.all([
    ctx.supabase.from("agents").select("id, name, description").eq("project_id", ctx.project.id).eq("is_active", true).order("created_at"),
    ctx.supabase.from("conversations").select("id, title, agent_id, updated_at").eq("project_id", ctx.project.id).eq("user_id", ctx.user.id).order("updated_at", { ascending: false }).limit(40),
  ]);
  if (!agents?.length) return <Empty icon="bot" title="Nenhum agente ativo" text="Peça a um administrador para ativar um agente neste projeto." />;

  let messages: UIMessage[] = [];
  const conv = sp.c ? conversations?.find((c) => c.id === sp.c) : undefined;
  if (conv) {
    const { data } = await ctx.supabase.from("messages")
      .select("id, role, content, message_sources(similarity, excerpt, source:knowledge_sources(id, name))")
      .eq("conversation_id", conv.id).order("created_at");
    messages = (data ?? []).map((m) => ({
      id: m.id, role: m.role as "user" | "assistant", content: m.content,
      sources: (m.message_sources as unknown as { similarity: number; excerpt: string; source: { id: string; name: string } | null }[] ?? [])
        .map((s) => ({ source_id: s.source?.id ?? "", source_name: s.source?.name ?? "Fonte removida ou sem acesso", similarity: s.similarity, excerpt: s.excerpt })),
    }));
  }

  const agentId = conv?.agent_id ?? (agents.some((a) => a.id === sp.agent) ? sp.agent! : agents[0].id);
  return (
    <ChatView key={conv?.id ?? `new-${agentId}`} projectId={ctx.project.id} agents={agents} conversations={conversations ?? []}
      initialAgentId={agentId} conversationId={conv?.id ?? null} initialMessages={messages} />
  );
}
