-- Nexo — convites por link, IAs de cada usuário e cobrança de tokens por projeto

-- Membros: cargo, empresa e status (pendente até o dono aprovar) ---------------------
alter table public.project_members add column job_title text;
alter table public.project_members add column company text;
alter table public.project_members add column status text not null default 'active' check (status in ('active', 'pending'));

-- Membro pendente ainda não tem acesso: o papel só vale com status ativo.
create or replace function public.project_role_of(p_project uuid) returns public.project_role
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from project_members where project_id = p_project and user_id = auth.uid() and status = 'active'),
    (select 'admin'::public.project_role from projects p
      where p.id = p_project and public.is_org_admin(p.organization_id))
  )
$$;

-- O próprio usuário vê a sua linha (inclusive pendente) para saber que aguarda aprovação.
create policy pm_select_self on public.project_members for select using (user_id = auth.uid());

-- Links de convite -------------------------------------------------------------------
create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(12), 'hex'),
  label text,
  role public.project_role not null default 'collaborator' check (role in ('collaborator', 'reader')),
  is_external boolean not null default true,
  allowed_functions public.member_function[] not null default '{}',
  requires_approval boolean not null default false,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.project_invites (project_id);
alter table public.project_invites enable row level security;
create policy inv_manage on public.project_invites for all
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- IAs conectadas por cada usuário (chave no Vault) -------------------------------------
create table public.user_ai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  provider text not null,
  base_url text not null,
  chat_model text not null,
  secret_id uuid,
  key_hint text,
  created_at timestamptz not null default now()
);
create index on public.user_ai_connections (user_id);
alter table public.user_ai_connections enable row level security;
create policy uac_own_select on public.user_ai_connections for select using (user_id = auth.uid());
create policy uac_own_delete on public.user_ai_connections for delete using (user_id = auth.uid());
-- inserção/atualização só pelo servidor (precisa gravar a chave no Vault)

-- Cobrança por projeto --------------------------------------------------------------------
create table public.project_ai_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  billing_mode text not null default 'owner' check (billing_mode in ('owner', 'member', 'mixed')),
  monthly_limit_member int check (monthly_limit_member is null or monthly_limit_member >= 0),
  monthly_limit_external int check (monthly_limit_external is null or monthly_limit_external >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.project_ai_settings enable row level security;
create policy pas_select on public.project_ai_settings for select using (public.is_project_member(project_id));
create policy pas_write on public.project_ai_settings for all
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- Qual IA cada pessoa usa em cada projeto (null = IA da empresa dona) ------------------
create table public.project_member_ai (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.user_ai_connections(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_member_ai enable row level security;
create policy pma_own on public.project_member_ai for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_project_member(project_id));

-- Quem pagou cada resposta ----------------------------------------------------------------
alter table public.messages add column billed_to text check (billed_to in ('owner', 'member'));
alter table public.messages add column ai_label text;

-- Perguntas do usuário atual neste mês pagas pela empresa dona (para o limite)
create or replace function public.my_owner_billed_this_month(p_project uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from messages m join conversations c on c.id = m.conversation_id
  where c.user_id = auth.uid() and c.project_id = p_project and m.role = 'assistant'
    and m.billed_to = 'owner' and m.created_at >= date_trunc('month', now())
$$;

-- Consumo do projeto no mês por pessoa (só administradores do projeto)
create or replace function public.project_ai_usage(p_project uuid) returns table (
  user_id uuid, full_name text, email text, company text, job_title text, is_external boolean,
  questions_owner int, questions_member int, tokens_in bigint, tokens_out bigint
)
language sql stable security definer set search_path = public as $$
  select c.user_id, p.full_name, p.email, pm.company, pm.job_title, coalesce(pm.is_external, false),
    count(*) filter (where m.billed_to = 'owner')::int,
    count(*) filter (where m.billed_to = 'member')::int,
    coalesce(sum(m.tokens_input) filter (where m.billed_to = 'owner'), 0)::bigint,
    coalesce(sum(m.tokens_output) filter (where m.billed_to = 'owner'), 0)::bigint
  from messages m
  join conversations c on c.id = m.conversation_id
  left join profiles p on p.id = c.user_id
  left join project_members pm on pm.project_id = c.project_id and pm.user_id = c.user_id
  where public.can_manage_project(p_project)
    and c.project_id = p_project and m.role = 'assistant' and m.created_at >= date_trunc('month', now())
  group by c.user_id, p.full_name, p.email, pm.company, pm.job_title, pm.is_external
  order by 7 desc
$$;

-- Auditoria dos convites
do $$ begin
  execute 'create trigger audit_project_invites after insert or update or delete on public.project_invites for each row execute function public.audit_row()';
end $$;
