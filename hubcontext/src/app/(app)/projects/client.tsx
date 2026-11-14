"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, selectProject, updateProject } from "@/app/actions/projects";
import { FormMessage, Sheet, Submit } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Project } from "@/lib/context";

export function ProjectForm({ project }: { project?: Project }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(project ? updateProject : createProject, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setOpen(false); router.refresh(); } }, [state, router]);
  return (
    <>
      {project ? <button className="btn btn-sm" onClick={() => setOpen(true)}>Editar</button>
        : <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Novo projeto</button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={project ? "Editar projeto" : "Novo projeto"}>
        <form action={action} className="form">
          {project && <input type="hidden" name="id" value={project.id} />}
          <label className="field"><span>Nome</span><input className="input" name="name" defaultValue={project?.name} required /></label>
          <label className="field"><span>Descrição</span><textarea className="textarea" name="description" defaultValue={project?.description ?? ""} /></label>
          <div className="grid-2">
            <label className="field"><span>Ambiente</span>
              <select className="select" name="environment" defaultValue={project?.environment ?? "development"}>
                <option value="development">Desenvolvimento</option><option value="staging">Homologação</option><option value="production">Produção</option>
              </select>
            </label>
            <label className="field"><span>Status</span>
              <select className="select" name="status" defaultValue={project?.status ?? "active"}>
                <option value="active">Ativo</option><option value="paused">Pausado</option><option value="archived">Arquivado</option>
              </select>
            </label>
          </div>
          <FormMessage state={state} />
          <Submit>{project ? "Salvar" : "Criar projeto"}</Submit>
        </form>
      </Sheet>
    </>
  );
}

export function SelectButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await selectProject(id); router.push("/dashboard"); })}>Abrir</button>;
}
