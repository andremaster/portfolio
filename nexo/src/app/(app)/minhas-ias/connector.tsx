"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMcpToken, revokeMcpToken } from "@/app/actions/user-ai";
import { Icon } from "@/components/icons";

type Tok = { id: string; label: string; last_used_at: string | null; created_at: string };

const CLIENTS = [
  ["Claude (claude.ai / app)", "Configurações → Conectores → Adicionar conector personalizado → URL: o endereço base → Autenticação: “Sem login” → Cabeçalhos de requisição → Adicionar: nome Authorization, valor Bearer <chave>. O Claude guarda a chave criptografada e não mostra mais."],
  ["Claude Code", "claude mcp add --transport http nexo <endereço base> --header \"Authorization: Bearer <chave>\""],
  ["Gemini CLI", "~/.gemini/settings.json → \"mcpServers\": { \"nexo\": { \"httpUrl\": \"<endereço base>\", \"headers\": { \"Authorization\": \"Bearer <chave>\" } } }"],
  ["Cursor / VS Code", "Adicione um servidor MCP do tipo HTTP com o endereço base e o cabeçalho Authorization: Bearer <chave>."],
  ["ChatGPT (modo desenvolvedor)", "Ainda não aceita cabeçalho: use o “endereço com a chave” (Configurações → Apps e conectores → Avançado → Modo desenvolvedor → Criar → autenticação: nenhuma). Não mostre esse endereço a ninguém."],
] as const;

function Copy({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="row"><span className="small muted" style={{ minWidth: 110 }}>{label}</span><code className="grow" style={{ wordBreak: "break-all" }}>{value}</code>
      <button className="btn btn-sm" onClick={async () => { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}><Icon name="copy" size={14} /> {ok ? "Copiado!" : "Copiar"}</button>
    </div>
  );
}

export function ConnectorPanel({ tokens }: { tokens: Tok[] }) {
  const [pending, start] = useTransition();
  const [made, setMade] = useState<{ url: string; base: string; key: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="form">
      <p className="muted small">Use o Nexo <b>dentro</b> do ChatGPT, Claude ou Gemini que você já paga: a IA busca o contexto do projeto, mostra a ficha e importa a conversa atual para o Nexo (resumo .md, conversa completa ou os dois). Tudo com as suas permissões.</p>

      {made ? (
        <div className="subcard">
          <b>Copie agora — a chave não será mostrada de novo.</b>
          <span className="small"><b>Recomendado</b> (Claude, Claude Code, Gemini CLI, Cursor): endereço sem segredo + chave no cabeçalho.</span>
          <Copy label="Endereço base" value={made.base} />
          <Copy label="Cabeçalho" value={`Authorization: Bearer ${made.key}`} />
          <Copy label="Só o valor" value={`Bearer ${made.key}`} />
          <details>
            <summary className="small" style={{ cursor: "pointer" }}>Para o ChatGPT (endereço com a chave)</summary>
            <Copy label="Endereço" value={made.url} />
          </details>
          <small className="muted">Trate a chave como senha e não a mostre em capturas de tela. Se vazar, revogue abaixo e gere outra.</small>
        </div>
      ) : (
        <div><button className="btn btn-primary" disabled={pending}
          onClick={() => start(async () => { setErr(null); const r = await createMcpToken("Conector"); if (r.url && r.base && r.key) { setMade({ url: r.url, base: r.base, key: r.key }); router.refresh(); } else setErr(r.error ?? "Erro"); })}>
          <Icon name="plug" size={16} /> {pending ? "Gerando…" : "Gerar chave do conector"}</button></div>
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
