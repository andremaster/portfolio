"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMcpToken, revokeMcpToken } from "@/app/actions/user-ai";
import { Icon } from "@/components/icons";

type Tok = { id: string; label: string; last_used_at: string | null; created_at: string };

const CLIENTS = [
  ["Claude (claude.ai / app)", "Configurações → Conectores → Adicionar conector personalizado → cole o endereço. Em qualquer conversa ou projeto, ative o “Nexo” no menu de ferramentas."],
  ["ChatGPT", "Configurações → Apps e conectores → Avançado → ative o Modo desenvolvedor → Criar → cole o endereço (autenticação: nenhuma). Depois, na conversa, ative o Nexo em “+ → Mais”."],
  ["Gemini CLI", "No arquivo ~/.gemini/settings.json, em \"mcpServers\", adicione \"nexo\": { \"httpUrl\": \"<endereço>\" }."],
  ["Claude Code / Cursor / VS Code", "claude mcp add --transport http nexo <endereço>  (Cursor e VS Code: adicione um servidor MCP do tipo HTTP com o endereço)."],
] as const;

export function ConnectorPanel({ tokens }: { tokens: Tok[] }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  return (
    <div className="form">
      <p className="muted small">Use o Nexo <b>dentro</b> do ChatGPT, Claude ou Gemini que você já paga: a IA busca o contexto do projeto, mostra a ficha e importa a conversa atual para o Nexo (resumo .md, conversa completa ou os dois). Tudo com as suas permissões.</p>

      {url ? (
        <div className="subcard">
          <b>Seu endereço do conector (copie agora — ele não será mostrado de novo):</b>
          <div className="row"><code className="grow" style={{ wordBreak: "break-all" }}>{url}</code>
            <button className="btn btn-sm" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}><Icon name="copy" size={14} /> {copied ? "Copiado!" : "Copiar"}</button>
          </div>
          <small className="muted">Trate como senha: quem tiver este endereço acessa os seus projetos. Se vazar, revogue abaixo.</small>
        </div>
      ) : (
        <div><button className="btn btn-primary" disabled={pending}
          onClick={() => start(async () => { setErr(null); const r = await createMcpToken("Conector"); if (r.url) { setUrl(r.url); router.refresh(); } else setErr(r.error ?? "Erro"); })}>
          <Icon name="plug" size={16} /> {pending ? "Gerando…" : "Gerar endereço do conector"}</button></div>
      )}
      {err && <div className="alert alert-error">{err}</div>}

      <details className="subcard">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Como adicionar em cada IA</summary>
        <div className="list small" style={{ marginTop: 8 }}>
          {CLIENTS.map(([n, how]) => <div className="list-item" key={n} style={{ display: "grid", gap: 4 }}><b>{n}</b><span className="muted">{how}</span></div>)}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Exemplos de uso na conversa: “liste meus projetos no Nexo”, “traga a ficha do projeto Atlas”, “busque no Nexo como funciona a autenticação”, “importe esta conversa para o projeto Atlas (resumo e completa)”.</p>
      </details>

      {tokens.length > 0 && (
        <div className="list">
          {tokens.map((t) => (
            <div className="list-item" key={t.id}>
              <div className="grow small"><b>{t.label}</b> <span className="muted">· criado em {new Date(t.created_at).toLocaleDateString("pt-BR")} · {t.last_used_at ? `último uso ${new Date(t.last_used_at).toLocaleString("pt-BR")}` : "ainda não usado"}</span></div>
              <button className="btn btn-ghost btn-danger btn-sm" disabled={pending}
                onClick={() => { if (confirm("Revogar este conector? As IAs que usam este endereço perdem o acesso.")) start(async () => { await revokeMcpToken(t.id); router.refresh(); }); }}>Revogar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
