/** Lê o arquivo de exportação do ChatGPT ou do Claude (conversations.json) e devolve conversas em texto. */
export type ExportedChat = { id: string; title: string; date: string | null; messages: number; text: string; source: "chatgpt" | "claude" };

type GptNode = { message?: { author?: { role?: string }; content?: { parts?: unknown[]; text?: string } } | null; parent?: string | null };
type GptConv = { id?: string; conversation_id?: string; title?: string; create_time?: number; mapping?: Record<string, GptNode>; current_node?: string };
type ClaudeMsg = { sender?: string; text?: string; content?: { type?: string; text?: string }[] };
type ClaudeConv = { uuid?: string; name?: string; created_at?: string; chat_messages?: ClaudeMsg[] };

const label = (r: string) => (r === "user" || r === "human" ? "Usuário" : "IA");

function fromChatGPT(c: GptConv, i: number): ExportedChat | null {
  if (!c.mapping) return null;
  const lines: string[] = [];
  let node = c.current_node ? c.mapping[c.current_node] : undefined;
  const chain: GptNode[] = [];
  const seen = new Set<string>();
  let key = c.current_node;
  while (node && key && !seen.has(key)) { seen.add(key); chain.push(node); key = node.parent ?? undefined; node = key ? c.mapping[key] : undefined; }
  for (const n of chain.reverse()) {
    const role = n.message?.author?.role;
    if (role !== "user" && role !== "assistant") continue;
    const parts = (n.message?.content?.parts ?? []).filter((p): p is string => typeof p === "string").join("\n").trim() || (n.message?.content?.text ?? "").trim();
    if (parts) lines.push(`${label(role)}: ${parts}`);
  }
  if (!lines.length) return null;
  return { id: c.id ?? c.conversation_id ?? `gpt-${i}`, title: c.title || "Conversa sem título", date: c.create_time ? new Date(c.create_time * 1000).toISOString() : null, messages: lines.length, text: lines.join("\n\n"), source: "chatgpt" };
}

function fromClaude(c: ClaudeConv, i: number): ExportedChat | null {
  const lines = (c.chat_messages ?? []).map((m) => {
    const t = (m.text?.trim() || (m.content ?? []).filter((x) => x.type === "text").map((x) => x.text ?? "").join("\n").trim());
    return t ? `${label(m.sender ?? "")}: ${t}` : "";
  }).filter(Boolean);
  if (!lines.length) return null;
  return { id: c.uuid ?? `claude-${i}`, title: c.name || "Conversa sem título", date: c.created_at ?? null, messages: lines.length, text: lines.join("\n\n"), source: "claude" };
}

export function parseConversations(json: unknown): ExportedChat[] {
  const arr = Array.isArray(json) ? json : [];
  const out: ExportedChat[] = [];
  arr.forEach((c, i) => {
    const r = c && typeof c === "object" && "mapping" in c ? fromChatGPT(c as GptConv, i) : fromClaude(c as ClaudeConv, i);
    if (r) out.push(r);
  });
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
