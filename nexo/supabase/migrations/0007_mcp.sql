-- Nexo — conector MCP (ChatGPT, Claude, Gemini e IDEs)
-- Cada usuário gera um endereço pessoal do conector. Guardamos só o hash do token.
-- As funções mcp_* rodam "como o usuário": definem auth.uid() para a transação e
-- reaproveitam as mesmas funções de permissão do site (RLS lógico). Só o servidor chama.

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Conector',
  last_used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.mcp_tokens (user_id);
alter table public.mcp_tokens enable row level security;
create policy mcp_own_select on public.mcp_tokens for select using (user_id = auth.uid());
create policy mcp_own_update on public.mcp_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Executa o restante da transação como o usuário informado
create or replace function public.mcp_set_user(p_user uuid) returns void
language sql volatile set search_path = public as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$$;

-- Projetos que o usuário pode ver
create or replace function public.mcp_projects(p_user uuid) returns table (id uuid, name text, organization text, role text, is_external boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform public.mcp_set_user(p_user);
  return query
    select p.id, p.name, o.name, public.project_role_of(p.id)::text, public.is_project_external(p.id)
    from projects p join organizations o on o.id = p.organization_id
    where p.status <> 'archived' and public.is_project_member(p.id)
    order by o.name, p.name;
end $$;

-- Ficha + lista de fontes visíveis para o usuário
create or replace function public.mcp_brief(p_user uuid, p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.mcp_set_user(p_user);
  if not public.is_project_member(p_project) then return null; end if;
  select jsonb_build_object(
    'project', (select jsonb_build_object('id', id, 'name', name, 'description', description, 'organization_id', organization_id) from projects where id = p_project),
    'brief', (select to_jsonb(b) - 'project_id' - 'updated_by' from project_briefs b where b.project_id = p_project),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'type', s.source_type, 'category', s.category, 'status', s.status) order by s.category, s.name)
                from knowledge_sources s where s.project_id = p_project and public.can_read_source(s.id)), '[]'::jsonb),
    'role', public.project_role_of(p_project)::text,
    'is_external', public.is_project_external(p_project)
  ) into v;
  return v;
end $$;

-- Busca vetorial com as permissões do usuário (reaproveita match_chunks)
create or replace function public.mcp_search(p_user uuid, p_project uuid, p_embedding vector(1536), p_count int default 6)
returns table (chunk_id uuid, source_id uuid, source_name text, category text, content text, metadata jsonb, similarity real)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.mcp_set_user(p_user);
  if not public.is_project_member(p_project) then return; end if;
  return query select * from public.match_chunks(p_project, p_embedding, p_count, '{}'::text[], 0.15::real);
end $$;

-- Pode escrever / administrar? (para importar e preencher a ficha)
create or replace function public.mcp_perms(p_user uuid, p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.mcp_set_user(p_user);
  return jsonb_build_object('member', public.is_project_member(p_project), 'write', public.can_write_project(p_project), 'manage', public.can_manage_project(p_project));
end $$;

revoke all on function public.mcp_set_user(uuid) from public, anon, authenticated;
revoke all on function public.mcp_projects(uuid) from public, anon, authenticated;
revoke all on function public.mcp_brief(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mcp_search(uuid, uuid, vector, int) from public, anon, authenticated;
revoke all on function public.mcp_perms(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_projects(uuid) to service_role;
grant execute on function public.mcp_brief(uuid, uuid) to service_role;
grant execute on function public.mcp_search(uuid, uuid, vector, int) to service_role;
grant execute on function public.mcp_perms(uuid, uuid) to service_role;
grant execute on function public.mcp_set_user(uuid) to service_role;
