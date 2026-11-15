"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBrief } from "@/app/actions/brief";
import { FormMessage, Sheet, Submit } from "@/components/ui";

const SECTIONS: [string, string, string][] = [
  ["objective", "Objetivo", "Ex.: Reduzir em 50% o tempo de análise de crédito sem aumentar a inadimplência."],
  ["scope", "Escopo", "Inclui: … / Não inclui: …"],
  ["business_rules", "Regras de negócio", "Uma regra por linha."],
  ["restrictions", "Restrições", "LGPD, políticas internas, exigências de risco e segurança."],
  ["success_criteria", "Critérios de sucesso", "Metas mensuráveis."],
  ["stakeholders", "Áreas e responsáveis", "Patrocinador, produto, dados, jurídico, fornecedores…"],
  ["glossary", "Glossário", "Termo: significado"],
];

export function BriefEditor({ brief }: { brief: Record<string, string | null> | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveBrief, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setOpen(false); router.refresh(); } }, [state, router]);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>Editar ficha</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Editar ficha do projeto">
        <form action={action} className="form">
          {SECTIONS.map(([k, label, ph]) => (
            <label className="field" key={k}><span>{label}</span>
              <textarea className="textarea" name={k} defaultValue={brief?.[k] ?? ""} placeholder={ph} style={{ minHeight: k === "objective" ? 80 : 110 }} />
            </label>
          ))}
          <p className="small muted">Não inclua dados pessoais ou segredos: a ficha é enviada aos modelos de IA.</p>
          <FormMessage state={state} />
          <Submit>Salvar ficha</Submit>
        </form>
      </Sheet>
    </>
  );
}
