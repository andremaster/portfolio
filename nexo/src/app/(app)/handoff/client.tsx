"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveHandoff, rejectHandoff } from "@/app/actions/handoffs";
import type { DiffLine } from "@/lib/diff";

export function ReviewActions({ id, fillBrief }: { id: string; fillBrief: boolean }) {
  const [pending, start] = useTransition();
  const [fill, setFill] = useState(fillBrief);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const router = useRouter();
  return (
    <div className="subcard">
      <b>Revisão</b>
      <label className="check"><input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Preencher campos vazios da ficha do projeto com este handoff</label>
      <input className="input" placeholder="Nota (opcional), ex.: ajustar seção de riscos" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row row-wrap">
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await approveHandoff(id, fill, note); setMsg(r); router.refresh(); })}>
          {pending ? "Aplicando…" : "Aprovar e colocar em vigor"}
        </button>
        <button className="btn btn-ghost btn-danger" disabled={pending} onClick={() => start(async () => { const r = await rejectHandoff(id, note); setMsg(r); router.refresh(); })}>Rejeitar</button>
      </div>
      {msg?.ok && <div className="alert alert-ok">{msg.ok}</div>}
      {msg?.error && <div className="alert alert-error">{msg.error}</div>}
    </div>
  );
}

/** Mostra a diferença; trechos iguais longos ficam recolhidos. */
export function DiffView({ lines }: { lines: DiffLine[] }) {
  const [all, setAll] = useState(false);
  const blocks: (DiffLine | { kind: "gap"; n: number })[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!all && l.kind === "same") {
      let j = i; while (j < lines.length && lines[j].kind === "same") j++;
      const run = j - i;
      if (run > 6) {
        blocks.push(...lines.slice(i, i + 2)); blocks.push({ kind: "gap", n: run - 4 }); blocks.push(...lines.slice(j - 2, j));
        i = j - 1; continue;
      }
    }
    blocks.push(l);
  }
  return (
    <div className="diff">
      {blocks.map((b, i) => b.kind === "gap"
        ? <button key={i} className="diff-gap" onClick={() => setAll(true)}>… {b.n} linhas iguais (mostrar tudo)</button>
        : <div key={i} className={`diff-line diff-${b.kind}`}><span>{b.kind === "add" ? "+" : b.kind === "del" ? "−" : " "}</span>{b.text || " "}</div>)}
    </div>
  );
}
