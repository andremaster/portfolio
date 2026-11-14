-- Testes de isolamento. Falha com exception se alguma regra vazar.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@acme.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dev@acme.test'),
  ('00000000-0000-0000-0000-00000000000c', 'terceiro@fornecedor.test'),
  ('00000000-0000-0000-0000-00000000000d', 'owner@outra.test');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.create_organization('Acme', 'acme') as org \gset
insert into projects (organization_id, name, created_by) values (:'org', 'Projeto A', auth.uid()) returning id as proj \gset
insert into project_members (project_id, user_id, role) values
  (:'proj', '00000000-0000-0000-0000-00000000000b', 'reader'),
  (:'proj', '00000000-0000-0000-0000-00000000000c', 'collaborator');
update project_members set is_external = true where user_id = '00000000-0000-0000-0000-00000000000c';
insert into knowledge_sources (project_id, name, source_type, category, status, created_by)
  values (:'proj', 'Arquitetura', 'document', 'arquitetura', 'indexed', auth.uid()) returning id as s1 \gset
insert into knowledge_sources (project_id, name, source_type, category, status, created_by)
  values (:'proj', 'Contrato interno', 'document', 'juridico', 'indexed', auth.uid()) returning id as s2 \gset
insert into source_access (source_id, user_id) values (:'s1', '00000000-0000-0000-0000-00000000000c');
reset role;
insert into document_chunks (source_id, project_id, content, chunk_index, embedding)
select :'s1'::uuid, :'proj'::uuid, 'arquitetura chunk', 0, array_fill(0.1::real, array[1536])::vector
union all select :'s2'::uuid, :'proj'::uuid, 'segredo juridico', 0, array_fill(0.1::real, array[1536])::vector;

-- Owner vê as duas fontes
set role authenticated;
do $$ begin
  if (select count(*) from knowledge_sources) <> 2 then raise exception 'owner deveria ver 2 fontes'; end if;
end $$;

-- Reader interno vê tudo, mas não escreve
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from knowledge_sources) <> 2 then raise exception 'reader deveria ver 2 fontes'; end if;
  begin
    insert into knowledge_sources (project_id, name, source_type, created_by)
      select id, 'x', 'text', auth.uid() from projects limit 1;
    raise exception 'reader NÃO deveria inserir';
  exception when insufficient_privilege then null; end;
end $$;

-- Externo vê só a fonte liberada, inclusive na busca vetorial
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ declare p uuid; n int; begin
  if (select count(*) from knowledge_sources) <> 1 then raise exception 'externo deveria ver 1 fonte'; end if;
  select id into p from projects;
  select count(*) into n from match_chunks(p, array_fill(0.1::real, array[1536])::vector, 10);
  if n <> 1 then raise exception 'RAG vazou para externo: % chunks', n; end if;
  if exists (select 1 from match_chunks(p, array_fill(0.1::real, array[1536])::vector, 10) where content like '%juridico%')
    then raise exception 'conteúdo restrito vazou'; end if;
  if exists (select 1 from integrations) then raise exception 'externo não vê integrações'; end if;
end $$;

-- Público por função: fonte só para Jurídico
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into knowledge_sources (project_id, name, source_type, category, status, created_by, audiences)
  select id, 'Parecer jurídico', 'document', 'juridico', 'indexed', auth.uid(), '{legal}' from projects where name = 'Projeto A';
insert into project_briefs (project_id, objective) select id, 'Reduzir tempo de onboarding' from projects where name = 'Projeto A';
update project_members set function = 'developer' where user_id = '00000000-0000-0000-0000-00000000000b';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if exists (select 1 from knowledge_sources where name = 'Parecer jurídico') then raise exception 'dev viu fonte do jurídico'; end if;
  if not exists (select 1 from project_briefs) then raise exception 'membro deveria ler a ficha'; end if;
  begin
    update project_briefs set objective = 'x';
    if found then raise exception 'reader editou a ficha'; end if;
  end;
end $$;
reset role;
update project_members set function = 'legal' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin
  if not exists (select 1 from knowledge_sources where name = 'Parecer jurídico') then raise exception 'jurídico deveria ver a fonte'; end if;
end $$;

-- Outra organização não vê nada
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
do $$ begin
  if exists (select 1 from organizations) then raise exception 'org vazou'; end if;
  if exists (select 1 from projects) then raise exception 'projeto vazou'; end if;
  if exists (select 1 from document_chunks) then raise exception 'chunk vazou'; end if;
  if exists (select 1 from profiles where email like '%acme%') then raise exception 'perfil vazou'; end if;
end $$;
select public.create_organization('Outra', 'outra') as org2 \gset
do $$ begin
  if (select count(*) from organizations) <> 1 then raise exception 'deveria ver só a própria org'; end if;
end $$;

-- Usuário sem login não vê nada
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if exists (select 1 from projects) then raise exception 'anônimo vê projeto'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from audit_logs) < 5 then raise exception 'auditoria não registrou'; end if;
end $$;
select 'RLS OK — ' || count(*) || ' eventos de auditoria' from audit_logs;
