"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui";
import { deleteConversation } from "@/app/actions/agents";

export type UISource = { source_id: string; source_name: string; similarity: number; excerpt: string };
export type UIMessage = { id: string; role: "user" | "assistant"; content: string; sources?: UISource[]; error?: boolean };
type Agent = { id: string; name: string; description: string | null };
type Conv = { id: string; title: string; agent_id: string | null; updated_at: string };

export function ChatView({ projectId, agents, conversations, initialAgentId, conversationId, initialMessages }: {
  projectId: string; agents: Agent[]; conversations: Conv[]; initialAgentId: string;
  conversationId: string | null; initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(initialAgentId);
  const [convId, setConvId] = useState(conversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(false);
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, agentId, conversationId: convId, message: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro inesperado.");
      setMessages((m) => [...m, { id: data.message.id, role: "assistant", content: data.message.content, sources: data.message.sources }]);
      if (!convId) {
        setConvId(data.conversationId);
        window.history.replaceState(null, "", `/chat?c=${data.conversationId}`);
        router.refresh();
      }
    } catch (e) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  const newChat = () => { router.push(`/chat?agent=${agentId}`); };

  const convList = (
    <div style={{ display: "grid", gap: 2 }}>
      {conversations.length === 0 && <p className="small muted">Nenhuma conversa ainda.</p>}
      {conversations.map((c) => (
        <div key={c.id} className={`conv-link ${c.id === convId ? "active" : ""}`}>
          <Link href={`/chat?c=${c.id}`} className="grow ellipsis" onClick={() => setHistory(false)}>{c.title}</Link>
          <button className="btn btn-ghost icon-btn btn-sm" title="Excluir conversa" aria-label="Excluir conversa"
            onClick={() => { if (confirm("Excluir esta conversa e seu histórico?")) start(async () => { await deleteConversation(c.id); if (c.id === convId) router.push("/chat"); else router.refresh(); }); }}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="chat">
      <aside className="chat-side">
        <button className="btn btn-primary btn-block" onClick={newChat}><Icon name="plus" size={16} /> Nova conversa</button>
        <div className="small muted" style={{ fontWeight: 600, marginTop: 8 }}>Agentes</div>
        {agents.map((a) => (
          <button key={a.id} className={`conv-link ${a.id === agentId ? "active" : ""}`} style={{ border: 0, textAlign: "left", cursor: "pointer", background: undefined }}
            onClick={() => { if (a.id !== agentId) { if (messages.length) router.push(`/chat?agent=${a.id}`); else setAgentId(a.id); } }}>
            <Icon name="bot" size={16} /> <span className="ellipsis">{a.name}</span>
          </button>
        ))}
        <div className="small muted" style={{ fontWeight: 600, marginTop: 8 }}>Histórico</div>
        {convList}
      </aside>

      <section className="chat-main">
        <div className="chat-head">
          <div className="type-icon desktop-only"><Icon name="bot" /></div>
          <div className="grow" style={{ minWidth: 0 }}>
            <select className="select mobile-only" value={agentId} disabled={messages.length > 0}
              onChange={(e) => setAgentId(e.target.value)} style={{ height: 38, padding: "0 10px" }}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="desktop-only"><b>{agent?.name}</b><div className="small muted ellipsis">{agent?.description}</div></div>
          </div>
          <button className="btn btn-sm mobile-only" onClick={() => setHistory(true)}>Histórico</button>
          <button className="btn btn-sm" onClick={newChat}><Icon name="plus" size={14} /><span className="hide-sm">Nova</span></button>
        </div>

        <div className="chat-scroll" ref={scroller}>
          {messages.length === 0 && (
            <div className="empty" style={{ margin: "auto" }}>
              <div className="type-icon"><Icon name="bot" /></div>
              <h3 style={{ color: "var(--text)" }}>{agent?.name}</h3>
              <p>{agent?.description}</p>
              <div className="row row-wrap" style={{ justifyContent: "center" }}>
                {["Qual é a arquitetura do projeto?", "Como implemento uma nova rota de API?", "Por onde começo o onboarding?"].map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg msg-${m.role}`}>
              <div className="bubble" style={m.error ? { background: "var(--danger-soft)", color: "var(--danger)", borderColor: "transparent" } : undefined}>{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="sources">
                  <div className="small muted">Fontes utilizadas</div>
                  {m.sources.map((s, i) => (
                    <details className="source" key={i}>
                      <summary>
                        <span className="badge badge-primary">[{i + 1}]</span>
                        <span className="grow ellipsis">{s.source_name}</span>
                        <span className={`badge ${s.similarity > 0.5 ? "badge-ok" : s.similarity > 0.35 ? "badge-warn" : ""}`}>{Math.round(s.similarity * 100)}%</span>
                      </summary>
                      <p>{s.excerpt}</p>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="msg msg-assistant"><div className="bubble typing" aria-label="Respondendo"><span /><span /><span /></div></div>}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea className="textarea" value={input} rows={1} maxLength={4000} placeholder={`Pergunte ao ${agent?.name ?? "agente"}…`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <button className="btn btn-primary icon-btn" style={{ width: 44, height: 44 }} disabled={loading || !input.trim()} aria-label="Enviar"><Icon name="send" /></button>
        </form>
      </section>

      <Sheet open={history} onClose={() => setHistory(false)} title="Conversas">{convList}</Sheet>
    </div>
  );
}
