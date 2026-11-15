-- Nexo — IA da própria empresa (BYOK)
-- Cada organização conecta a sua IA (chave, endereço e modelo). As chaves ficam no
-- Supabase Vault (criptografadas); a tabela guarda só o id do segredo e uma dica (últimos 4).

create table public.org_ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  chat_provider text not null,
  chat_base_url text not null,
  chat_model text not null,
  chat_secret_id uuid,
  chat_key_hint text,
  embed_mode text not null default 'same' check (embed_mode in ('same', 'separate')),
  embed_provider text,
  embed_base_url text,
  embed_model text,
  embed_secret_id uuid,
  embed_key_hint text,
  embed_signature text, -- provedor+modelo de embeddings usado na última indexação
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger touch_org_ai_settings before update on public.org_ai_settings
  for each row execute function public.touch_updated_at();

alter table public.org_ai_settings enable row level security;
-- Membros veem o provedor/modelo e a dica da chave. Escrita só pelo servidor (service role)
-- depois de checar se o usuário é admin da organização.
create policy ai_settings_select on public.org_ai_settings for select using (public.is_org_member(organization_id));

-- Grava/atualiza um segredo no Vault. Somente service role.
create or replace function public.ai_put_secret(p_name text, p_secret text) returns uuid
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    v_id := vault.create_secret(p_secret, p_name, 'Nexo: chave de IA da organização');
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
  return v_id;
end $$;

-- Lê um segredo do Vault. Somente service role.
create or replace function public.ai_get_secret(p_id uuid) returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id
$$;

revoke all on function public.ai_put_secret(text, text) from public, anon, authenticated;
revoke all on function public.ai_get_secret(uuid) from public, anon, authenticated;
grant execute on function public.ai_put_secret(text, text) to service_role;
grant execute on function public.ai_get_secret(uuid) to service_role;

-- Origem da fonte (ex.: handoff importado de outra IA)
alter table public.knowledge_sources add column origin text;
