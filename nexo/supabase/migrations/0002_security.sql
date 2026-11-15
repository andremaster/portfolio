-- Nexo — funções de permissão, RLS, busca vetorial e auditoria

-- Helpers (security definer evita recursão de RLS) --------------------------
create or replace function public.org_role_of(p_org uuid) returns public.org_role
language sql stable security definer set search_path = public as $$
  select role from organization_members where organization_id = p_org and user_id = auth.uid()
$$;

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where organization_id = p_org and user_id = auth.uid())
$$;

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role_of(p_org) in ('owner', 'admin'), false)
$$;

-- Papel efetivo no projeto. Admin/owner da organização atua como admin do projeto.
create or replace function public.project_role_of(p_project uuid) returns public.project_role
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from project_members where project_id = p_project and user_id = auth.uid()),
    (select 'admin'::public.project_role from projects p
      where p.id = p_project and public.is_org_admin(p.organization_id))
  )
$$;

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.project_role_of(p_project) is not null
$$;

create or replace function public.is_project_external(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_external from project_members where project_id = p_project and user_id = auth.uid()), false)
$$;

create or replace function public.can_write_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role_of(p_project) in ('admin', 'collaborator'), false)
$$;

create or replace function public.can_manage_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role_of(p_project) = 'admin', false)
$$;

create or replace function public.has_source_grant(p_source uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from source_access where source_id = p_source and user_id = auth.uid())
$$;

-- Internos veem todas as fontes do projeto; externos só as liberadas em source_access.
create or replace function public.can_read_source(p_source uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from knowledge_sources s
    where s.id = p_source
      and public.is_project_member(s.project_id)
      and (
        not public.is_project_external(s.project_id)
        or exists (select 1 from source_access a where a.source_id = s.id and a.user_id = auth.uid())
      )
  )
$$;

-- Ativa RLS em tudo ------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.source_access enable row level security;
alter table public.document_chunks enable row level security;
alter table public.agents enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_sources enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_logs enable row level security;

-- organizations
create policy org_select on public.organizations for select using (public.is_org_member(id));
create policy org_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- organization_members
create policy orgm_select on public.organization_members for select using (public.is_org_member(organization_id));
create policy orgm_admin_ins on public.organization_members for insert with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy orgm_admin_upd on public.organization_members for update using (public.is_org_admin(organization_id) and role <> 'owner') with check (role <> 'owner');
create policy orgm_admin_del on public.organization_members for delete using (public.is_org_admin(organization_id) and role <> 'owner');

-- profiles: o próprio e colegas da mesma organização
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from organization_members a join organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (
  id = auth.uid() and (organization_id is null or public.is_org_member(organization_id))
);

-- projects
create policy projects_select on public.projects for select using (public.is_org_admin(organization_id) or public.is_project_member(id));
create policy projects_insert on public.projects for insert with check (public.is_org_admin(organization_id) and created_by = auth.uid());
create policy projects_update on public.projects for update using (public.can_manage_project(id)) with check (public.is_org_member(organization_id));
create policy projects_delete on public.projects for delete using (public.is_org_admin(organization_id));

-- project_members
create policy pm_select on public.project_members for select using (public.is_project_member(project_id));
create policy pm_insert on public.project_members for insert with check (public.can_manage_project(project_id));
create policy pm_update on public.project_members for update using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create policy pm_delete on public.project_members for delete using (public.can_manage_project(project_id) and user_id <> auth.uid());

-- knowledge_sources
-- usa as colunas da linha (e não can_read_source) para funcionar também em INSERT ... RETURNING
create policy ks_select on public.knowledge_sources for select using (
  public.is_project_member(project_id) and (
    not public.is_project_external(project_id)
    or public.has_source_grant(id)));
create policy ks_insert on public.knowledge_sources for insert with check (public.can_write_project(project_id) and created_by = auth.uid());
create policy ks_update on public.knowledge_sources for update using (public.can_write_project(project_id) and public.can_read_source(id)) with check (public.can_write_project(project_id));
create policy ks_delete on public.knowledge_sources for delete using (public.can_manage_project(project_id));

-- source_access (somente admins do projeto gerenciam; o próprio usuário vê suas liberações)
create policy sa_select on public.source_access for select using (
  user_id = auth.uid() or exists (select 1 from knowledge_sources s where s.id = source_id and public.can_manage_project(s.project_id)));
create policy sa_write on public.source_access for all using (
  exists (select 1 from knowledge_sources s where s.id = source_id and public.can_manage_project(s.project_id)))
  with check (exists (select 1 from knowledge_sources s where s.id = source_id and public.can_manage_project(s.project_id)));

-- document_chunks: leitura condicionada à fonte. Escrita apenas pelo servidor (service role).
create policy dc_select on public.document_chunks for select using (public.can_read_source(source_id));

-- agents
create policy agents_select on public.agents for select using (
  public.is_project_member(project_id) and (allow_external or not public.is_project_external(project_id)));
create policy agents_write on public.agents for all using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- conversations / messages / message_sources: privados do usuário
create policy conv_own on public.conversations for all
  using (user_id = auth.uid() and public.is_project_member(project_id))
  with check (user_id = auth.uid() and public.is_project_member(project_id));
create policy msg_own on public.messages for all
  using (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy msgsrc_own on public.message_sources for all
  using (exists (select 1 from messages m join conversations c on c.id = m.conversation_id where m.id = message_id and c.user_id = auth.uid()))
  with check (exists (select 1 from messages m join conversations c on c.id = m.conversation_id where m.id = message_id and c.user_id = auth.uid()));

-- integrations: somente internos veem; admins gerenciam
create policy int_select on public.integrations for select using (public.is_project_member(project_id) and not public.is_project_external(project_id));
create policy int_write on public.integrations for all using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- audit_logs: somente leitura para admins; inserção apenas registrando o próprio usuário
create policy audit_select on public.audit_logs for select using (
  public.is_org_admin(organization_id) or (project_id is not null and public.can_manage_project(project_id)));
create policy audit_insert on public.audit_logs for insert with check (
  user_id = auth.uid() and public.is_org_member(organization_id));

-- Busca vetorial (SECURITY INVOKER: o RLS de chunks e fontes se aplica) ----
create or replace function public.match_chunks(
  p_project uuid,
  p_embedding vector(1536),
  p_count int default 6,
  p_categories text[] default '{}',
  p_min_similarity real default 0.2
) returns table (
  chunk_id uuid, source_id uuid, source_name text, category text,
  content text, metadata jsonb, similarity real
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.source_id, s.name, s.category, c.content, c.metadata,
         (1 - (c.embedding <=> p_embedding))::real as similarity
  from document_chunks c
  join knowledge_sources s on s.id = c.source_id
  where c.project_id = p_project
    and s.project_id = p_project
    and s.status = 'indexed'
    and public.can_read_source(s.id)
    and (cardinality(p_categories) = 0 or s.category = any(p_categories))
    and c.embedding is not null
    and 1 - (c.embedding <=> p_embedding) >= p_min_similarity
  order by c.embedding <=> p_embedding
  limit least(greatest(p_count, 1), 20)
$$;

-- Onboarding de cliente: cria organização e torna o usuário owner --------
create or replace function public.create_organization(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name, slug) values (p_name, p_slug) returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, auth.uid(), 'owner');
  update profiles set organization_id = v_org where id = auth.uid();
  insert into audit_logs (organization_id, user_id, action, entity_type, entity_id)
    values (v_org, auth.uid(), 'create', 'organization', v_org::text);
  return v_org;
end $$;

-- Criador do projeto vira admin automaticamente
create or replace function public.add_project_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into project_members (project_id, user_id, role) values (new.id, new.created_by, 'admin')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end $$;
create trigger projects_add_creator after insert on public.projects
  for each row execute function public.add_project_creator();

-- Auditoria automática ---------------------------------------------------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb; o jsonb; v_project uuid; v_org uuid; v_entity text; v_meta jsonb := '{}';
begin
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;

  -- ignora atualizações só de status/contagem feitas pela indexação
  if tg_op = 'UPDATE' and tg_table_name = 'knowledge_sources'
     and (j - array['status','error_message','chunk_count','updated_at']) = (o - array['status','error_message','chunk_count','updated_at']) then
    return null;
  end if;

  if tg_table_name = 'projects' then
    v_project := (j->>'id')::uuid; v_org := (j->>'organization_id')::uuid;
  else
    if tg_table_name = 'source_access' then
      select project_id into v_project from knowledge_sources where id = (j->>'source_id')::uuid;
    else
      v_project := (j->>'project_id')::uuid;
    end if;
    select organization_id into v_org from projects where id = v_project;
  end if;

  v_entity := coalesce(j->>'id', (j->>'source_id') || ':' || (j->>'user_id'));
  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'name', j->>'name', 'role', j->>'role', 'user_id', j->>'user_id',
    'is_external', j->'is_external', 'is_active', j->'is_active'));

  insert into audit_logs (organization_id, project_id, user_id, action, entity_type, entity_id, metadata)
  values (v_org, v_project, auth.uid(), lower(tg_op), tg_table_name, v_entity, v_meta);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['projects','project_members','knowledge_sources','agents','source_access','integrations'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;

