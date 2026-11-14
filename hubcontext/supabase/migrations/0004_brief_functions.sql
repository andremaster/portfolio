-- HubContext — ficha do projeto e perfis por função

-- Função de cada pessoa no projeto (diferente do papel de permissão)
create type public.member_function as enum (
  'developer', 'data_engineer', 'data_analyst', 'legal', 'compliance', 'risk', 'business', 'product', 'other'
);
alter table public.project_members add column function public.member_function not null default 'other';

-- Ficha do projeto: contexto-base que a IA usa em TODAS as respostas
create table public.project_briefs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  objective text,
  scope text,
  business_rules text,
  restrictions text,
  success_criteria text,
  glossary text,
  stakeholders text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger touch_project_briefs before update on public.project_briefs
  for each row execute function public.touch_updated_at();

-- Fontes e agentes direcionados a funções (vazio = todas as funções)
alter table public.knowledge_sources add column audiences public.member_function[] not null default '{}';
alter table public.agents add column functions public.member_function[] not null default '{}';

create or replace function public.project_function_of(p_project uuid) returns public.member_function
language sql stable security definer set search_path = public as $$
  select function from project_members where project_id = p_project and user_id = auth.uid()
$$;

-- Público da fonte: admins veem tudo; demais só se a função estiver no público (ou público vazio)
create or replace function public.audience_allows(p_project uuid, p_audiences public.member_function[]) returns boolean
language sql stable security definer set search_path = public as $$
  select cardinality(p_audiences) = 0
      or public.project_role_of(p_project) = 'admin'
      or public.project_function_of(p_project) = any(p_audiences)
$$;

-- Leitura de fonte passa a considerar também o público por função
create or replace function public.can_read_source(p_source uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from knowledge_sources s
    where s.id = p_source
      and public.is_project_member(s.project_id)
      and public.audience_allows(s.project_id, s.audiences)
      and (
        not public.is_project_external(s.project_id)
        or exists (select 1 from source_access a where a.source_id = s.id and a.user_id = auth.uid())
      )
  )
$$;

drop policy ks_select on public.knowledge_sources;
create policy ks_select on public.knowledge_sources for select using (
  public.is_project_member(project_id)
  and public.audience_allows(project_id, audiences)
  and (not public.is_project_external(project_id) or public.has_source_grant(id)));

drop policy agents_select on public.agents;
create policy agents_select on public.agents for select using (
  public.is_project_member(project_id)
  and (allow_external or not public.is_project_external(project_id))
  and public.audience_allows(project_id, functions));

-- RLS da ficha: membros leem, admins editam
alter table public.project_briefs enable row level security;
create policy brief_select on public.project_briefs for select using (public.is_project_member(project_id));
create policy brief_write on public.project_briefs for all
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- Auditoria da ficha
create or replace function public.audit_brief() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (organization_id, project_id, user_id, action, entity_type, entity_id)
  select p.organization_id, new.project_id, auth.uid(), lower(tg_op), 'project_briefs', new.project_id::text
  from projects p where p.id = new.project_id;
  return null;
end $$;
create trigger audit_project_briefs after insert or update on public.project_briefs
  for each row execute function public.audit_brief();
