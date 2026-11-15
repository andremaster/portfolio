-- Nexo — versões do handoff do projeto (rascunho → aprovação do dono → versão vigente)
-- Tudo que chega de fora (conector MCP, colar handoff, exportação do ChatGPT/Claude) entra como
-- RASCUNHO. Só depois de aprovado vira fonte indexada (e, se pedido, preenche a ficha).

create table public.handoff_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_no int not null,
  title text not null,
  content_md text not null default '',
  transcript text,                         -- conversa completa (opcional)
  content_hash text not null,
  base_version_id uuid references public.handoff_versions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'superseded')),
  source text not null default 'ui' check (source in ('mcp', 'ui', 'import')),
  origin text,                             -- chatgpt | claude | gemini | copilot | outra
  fill_brief boolean not null default false,
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  unique (project_id, version_no)
);
create index on public.handoff_versions (project_id, status, created_at desc);

alter table public.projects add column if not exists current_handoff_id uuid references public.handoff_versions(id) on delete set null;

-- Número da versão e hash calculados no banco
create or replace function public.handoff_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(version_no), 0) + 1 into new.version_no from handoff_versions where project_id = new.project_id;
  new.content_hash := md5(coalesce(new.content_md, '') || coalesce(new.transcript, ''));
  return new;
end $$;
create trigger handoff_versions_before_insert before insert on public.handoff_versions
  for each row execute function public.handoff_before_insert();

alter table public.handoff_versions enable row level security;
-- Ver: administradores veem tudo; membros veem as aprovadas/substituídas e os próprios rascunhos.
create policy hv_select on public.handoff_versions for select using (
  public.can_manage_project(project_id)
  or (public.is_project_member(project_id) and (status in ('approved', 'superseded') or author_user_id = auth.uid()))
);
-- Enviar: quem pode escrever no projeto, sempre como rascunho e em nome próprio.
create policy hv_insert on public.handoff_versions for insert with check (
  public.can_write_project(project_id) and author_user_id = auth.uid() and status = 'draft'
);
-- Aprovar/rejeitar: só administradores do projeto.
create policy hv_update on public.handoff_versions for update
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

do $$ begin
  execute 'create trigger audit_handoff_versions after insert or update on public.handoff_versions for each row execute function public.audit_row()';
end $$;

-- Conector MCP: versão vigente (aprovada) do handoff, como o usuário
create or replace function public.mcp_handoff_current(p_user uuid, p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.mcp_set_user(p_user);
  if not public.is_project_member(p_project) then return null; end if;
  select jsonb_build_object('id', h.id, 'version_no', h.version_no, 'title', h.title, 'content_md', h.content_md, 'approved_at', h.reviewed_at)
    into v
  from projects p join handoff_versions h on h.id = p.current_handoff_id
  where p.id = p_project;
  return coalesce(v, '{}'::jsonb);
end $$;
revoke all on function public.mcp_handoff_current(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_handoff_current(uuid, uuid) to service_role;
