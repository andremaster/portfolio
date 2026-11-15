-- Nexo — Storage privado e controle de uso

-- Bucket privado. Caminho: {project_id}/{source_id}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge', 'knowledge', false, 20971520)
on conflict (id) do update set public = false;

create policy knowledge_read on storage.objects for select to authenticated using (
  bucket_id = 'knowledge'
  and public.can_read_source(((storage.foldername(name))[2])::uuid)
);
create policy knowledge_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'knowledge'
  and public.can_write_project(((storage.foldername(name))[1])::uuid)
);
create policy knowledge_delete on storage.objects for delete to authenticated using (
  bucket_id = 'knowledge'
  and public.can_manage_project(((storage.foldername(name))[1])::uuid)
);

-- Perguntas feitas hoje pelo usuário atual (limite diário por usuário)
create or replace function public.my_questions_today() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from messages m join conversations c on c.id = m.conversation_id
  where c.user_id = auth.uid() and m.role = 'user' and m.created_at >= date_trunc('day', now())
$$;

-- Indicadores do projeto para o dashboard (respeita RLS por ser invoker)
create or replace function public.project_stats(p_project uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'sources', (select count(*) from knowledge_sources where project_id = p_project),
    'indexed', (select count(*) from knowledge_sources where project_id = p_project and status = 'indexed'),
    'errors', (select count(*) from knowledge_sources where project_id = p_project and status = 'error'),
    'pending', (select count(*) from knowledge_sources where project_id = p_project and status in ('pending','processing')),
    'agents', (select count(*) from agents where project_id = p_project and is_active),
    'members', (select count(*) from project_members where project_id = p_project),
    'externals', (select count(*) from project_members where project_id = p_project and is_external),
    'chunks', (select coalesce(sum(chunk_count), 0) from knowledge_sources where project_id = p_project),
    'categories', (select count(distinct category) from knowledge_sources where project_id = p_project)
  )
$$;

-- Consultas totais do projeto (todos os usuários) — apenas números, sem conteúdo
create or replace function public.project_query_count(p_project uuid, p_days int default 30) returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_project_member(p_project) then (
    select count(*)::int from messages m join conversations c on c.id = m.conversation_id
    where c.project_id = p_project and m.role = 'user' and m.created_at >= now() - make_interval(days => p_days)
  ) else 0 end
$$;
