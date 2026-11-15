-- Nexo — busca nos documentos sem custo de IA
-- Base: busca textual do Postgres (português, sem acentos). Vetores (embeddings) viram opcionais:
-- quando a empresa conectou uma IA, as duas listas são combinadas por RRF (Reciprocal Rank Fusion).

create extension if not exists unaccent with schema extensions;

-- unaccent não é IMMUTABLE; este invólucro permite usá-lo em coluna gerada e índice
create or replace function public.f_unaccent(text) returns text
language sql immutable parallel safe strict set search_path = public, extensions as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

alter table public.document_chunks
  add column if not exists fts tsvector
  generated always as (to_tsvector('portuguese', public.f_unaccent(coalesce(content, '')))) stored;
create index if not exists document_chunks_fts_idx on public.document_chunks using gin (fts);

-- Pergunta em linguagem natural -> termos com OU (mais tolerante que E)
create or replace function public.nexo_tsquery(p_text text) returns tsquery
language sql immutable parallel safe set search_path = public as $$
  select case when q::text = '' then null else replace(q::text, '&', '|')::tsquery end
  from (select plainto_tsquery('portuguese', public.f_unaccent(coalesce(p_text, ''))) as q) t
$$;

-- Busca híbrida com as permissões do usuário (SECURITY INVOKER: vale o RLS + can_read_source)
create or replace function public.search_chunks(
  p_project uuid,
  p_query text,
  p_embedding vector(1536) default null,
  p_count int default 8,
  p_categories text[] default '{}'
) returns table (
  chunk_id uuid, source_id uuid, source_name text, category text,
  content text, metadata jsonb, similarity real
)
language sql stable security invoker set search_path = public, extensions as $$
  with allowed as (
    select c.id, c.source_id, s.name, s.category, c.content, c.metadata, c.fts, c.embedding
    from document_chunks c
    join knowledge_sources s on s.id = c.source_id
    where c.project_id = p_project and s.project_id = p_project
      and s.status = 'indexed'
      and public.can_read_source(s.id)
      and (cardinality(p_categories) = 0 or s.category = any(p_categories))
  ),
  q as (select public.nexo_tsquery(p_query) as tq),
  txt as (
    select a.id, row_number() over (order by ts_rank_cd(a.fts, q.tq) desc) as rn
    from allowed a, q
    where q.tq is not null and a.fts @@ q.tq
    order by ts_rank_cd(a.fts, q.tq) desc
    limit 50
  ),
  vec as (
    select a.id, row_number() over (order by a.embedding <=> p_embedding) as rn,
           (1 - (a.embedding <=> p_embedding))::real as sim
    from allowed a
    where p_embedding is not null and a.embedding is not null
    order by a.embedding <=> p_embedding
    limit 50
  ),
  fused as (
    select coalesce(t.id, v.id) as id,
           coalesce(1.0 / (60 + t.rn), 0) + coalesce(1.0 / (60 + v.rn), 0) as score,
           v.sim
    from txt t full outer join vec v on v.id = t.id
    where v.sim is null or v.sim >= 0.2 or t.id is not null
  ),
  ranked as (
    select f.*, max(f.score) over () as top from fused f
  )
  select a.id, a.source_id, a.name, a.category, a.content, a.metadata,
         coalesce(r.sim, (r.score / nullif(r.top, 0)))::real as similarity
  from ranked r join allowed a on a.id = r.id
  order by r.score desc
  limit least(greatest(p_count, 1), 30)
$$;

-- Conector MCP: mesma busca, rodando como o usuário
drop function if exists public.mcp_search(uuid, uuid, vector, int);
create or replace function public.mcp_search(p_user uuid, p_project uuid, p_query text, p_embedding vector(1536) default null, p_count int default 8)
returns table (chunk_id uuid, source_id uuid, source_name text, category text, content text, metadata jsonb, similarity real)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.mcp_set_user(p_user);
  if not public.is_project_member(p_project) then return; end if;
  return query select * from public.search_chunks(p_project, p_query, p_embedding, p_count, '{}'::text[]);
end $$;
revoke all on function public.mcp_search(uuid, uuid, text, vector, int) from public, anon, authenticated;
grant execute on function public.mcp_search(uuid, uuid, text, vector, int) to service_role;
