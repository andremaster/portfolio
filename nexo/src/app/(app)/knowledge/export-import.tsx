"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unzipSync, strFromU8 } from "fflate";
import { Sheet } from "@/components/ui";
import { Icon } from "@/components/icons";
import { parseConversations, type ExportedChat } from "@/lib/chat-export";
import { importExportedChats } from "@/app/actions/import-chats";

/** Importa conversas do arquivo de exportação do ChatGPT ou do Claude (.zip ou conversations.json). */
export function ExportImport() {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ExportedChat[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"completo" | "resumo" | "ambos">("ambos");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const shown = useMemo(() => chats.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())).slice(0, 300), [chats, q]);

  const read = async (file: File) => {
    setMsg(undefined); setChats([]); setPicked(new Set());
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let json: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const files = unzipSync(buf, { filter: (f) => f.name.endsWith("conversations.json") });
        const key = Object.keys(files)[0];
        if (!key) throw new Error("O .zip não tem conversations.json.");
        json = strFromU8(files[key]);
      } else json = strFromU8(buf);
      const list = parseConversations(JSON.parse(json));
      if (!list.length) throw new Error("Nenhuma conversa encontrada no arquivo.");
      setChats(list);
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "Arquivo inválido." });
    }
  };

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 20) n.add(id); return n; });

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><Icon name="download" size={16} style={{ transform: "rotate(180deg)" }} /> Importar exportação</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Importar conversas do ChatGPT ou do Claude">
        <div className="form">
          <p className="muted small">
            <b>ChatGPT:</b> Configurações → Controles de dados → Exportar dados (chega um .zip por e-mail).<br />
            <b>Claude:</b> Configurações → Privacidade → Exportar dados.<br />
            Envie o .zip (ou o conversations.json). O arquivo é lido no seu navegador; só as conversas que você marcar vão para o Nexo.
          </p>
          <input className="input" type="file" accept=".zip,.json,application/zip,application/json" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />

          {chats.length > 0 && (
            <>
              <div className="row row-wrap">
                <input className="input grow" placeholder={`Buscar entre ${chats.length} conversas…`} value={q} onChange={(e) => setQ(e.target.value)} />
                <span className="badge mono">{picked.size}/20 marcadas</span>
              </div>
              <div className="list" style={{ maxHeight: 300, overflow: "auto" }}>
                {shown.map((c) => (
                  <label className="list-item" key={c.id} style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontWeight: 600 }}>{c.title}</div>
                      <div className="small muted">{c.source === "claude" ? "Claude" : "ChatGPT"} · {c.messages} mensagens{c.date ? ` · ${new Date(c.date).toLocaleDateString("pt-BR")}` : ""}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="chips">
                {([["ambos", "Resumo + completa"], ["resumo", "Só resumo (.md)"], ["completo", "Só conversa completa"]] as const).map(([m, l]) => (
                  <button type="button" key={m} className={`chip ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>{l}</button>
                ))}
              </div>
              {mode !== "completo" && <small className="muted">O resumo é gerado pela IA que paga as perguntas neste projeto.</small>}
              <button className="btn btn-primary" disabled={pending || !picked.size}
                onClick={() => start(async () => {
                  const items = chats.filter((c) => picked.has(c.id)).map(({ title, date, text, source }) => ({ title, date, text, source }));
                  const r = await importExportedChats(items, mode);
                  setMsg(r);
                  if (r.ok) { setPicked(new Set()); router.refresh(); }
                })}>
                {pending ? "Importando e indexando…" : `Importar ${picked.size} conversa(s)`}
              </button>
            </>
          )}
          {msg?.error && <div className="alert alert-error">{msg.error}</div>}
          {msg?.ok && <div className="alert alert-ok">{msg.ok}</div>}
        </div>
      </Sheet>
    </>
  );
}
