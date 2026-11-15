# Deploy no servidor Autyma

## 1. Banco (escolha um)
- **A) Supabase Cloud** (mais simples): crie o projeto e rode as migrations de `supabase/migrations`.
- **B) Supabase self-hosted no servidor**: https://supabase.com/docs/guides/self-hosting/docker,
  depois aplique as migrations com `psql`. Exige backup, atualização e monitoramento por nossa conta.

## 2. Aplicação
```bash
git clone <repo> && cd nexo
cp .env.example .env      # preencha; nunca commitar
docker compose up -d --build
```

## 3. HTTPS (Caddy, exemplo)
```
hub.autyma.com.br {
  reverse_proxy 127.0.0.1:3000
}
```
Em Supabase → Auth → URL Configuration: Site URL e Redirect `https://hub.autyma.com.br/auth/callback`.

## 4. Atualizar
```bash
git pull && docker compose up -d --build
```

## Checklist de segurança do servidor
- Firewall: apenas 80/443 (e SSH restrito por IP/chave).
- `.env` com permissão 600, dono root.
- Backups diários do Postgres testados (restore mensal).
- Logs centralizados e alerta de disponibilidade.
