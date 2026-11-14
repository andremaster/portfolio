-- HubContext — núcleo multi-tenant
create extension if not exists "pgcrypto";
create extension if not exists vector with schema extensions;

-- Tipos -------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member');
create type public.project_role as enum ('admin', 'collaborator', 'reader');
create type public.source_type as enum ('document', 'code', 'url', 'image', 'diagram', 'decision', 'manual', 'api_spec', 'text');
create type public.source_status as enum ('pending', 'processing', 'indexed', 'error');
create type public.message_role as enum ('user', 'assistant', 'system');

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- Organizações (clientes do SaaS) -----------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_members (user_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projetos ----------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  environment text not null default 'development' check (environment in ('development', 'staging', 'production')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects (organization_id);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_role not null default 'reader',
  is_external boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index on public.project_members (user_id);

-- Conhecimento ------------------------------------------------------------
create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  source_type public.source_type not null,
  category text not null default 'geral',
  storage_path text,
  source_url text,
  raw_text text,
  status public.source_status not null default 'pending',
  error_message text,
  chunk_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.knowledge_sources (project_id, category);

-- Escopo explícito de fontes para usuários externos
create table public.source_access (
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (source_id, user_id)
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}',
  chunk_index int not null,
  token_count int not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index on public.document_chunks (project_id);
create index on public.document_chunks (source_id);
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- Agentes e conversas -----------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  system_prompt text not null,
  knowledge_scope text[] not null default '{}', -- categorias; vazio = todas
  model text,
  temperature numeric(3,2) not null default 0.2 check (temperature between 0 and 2),
  is_active boolean not null default true,
  allow_external boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.agents (project_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.conversations (user_id, project_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  model text,
  tokens_input int,
  tokens_output int,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create table public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete set null,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  similarity real,
  excerpt text,
  created_at timestamptz not null default now()
);
create index on public.message_sources (message_id);

-- Integrações e auditoria -------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  integration_type text not null,
  name text not null,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error', 'syncing')),
  configuration jsonb not null default '{}', -- NUNCA credenciais (use Supabase Vault)
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  -- sem FK: o log precisa sobreviver à exclusão de projetos/organizações
  organization_id uuid,
  project_id uuid,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (organization_id, created_at desc);
create index on public.audit_logs (project_id, created_at desc);

-- updated_at
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','projects','knowledge_sources','agents','conversations','integrations'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Perfil automático no cadastro
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
