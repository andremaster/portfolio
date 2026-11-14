#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrations e roda os testes de RLS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN=/usr/lib/postgresql/16/bin
DIR=$(mktemp -d); chown postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
run "$BIN/pg_ctl -D $DIR/data -o '-p 54329 -k $DIR' -l $DIR/log start >/dev/null"
trap 'run "$BIN/pg_ctl -D $DIR/data stop -m fast >/dev/null"; rm -rf "$DIR"' EXIT
P="psql -h $DIR -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c 'create database hub'
$P -d hub -f "$ROOT/tests/sql/supabase_stub.sql"
$P -d hub -c "select 1" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do $P -d hub -f "$f"; done
$P -d hub -f "$ROOT/tests/sql/grants.sql"
$P -d hub -f "$ROOT/supabase/seed.sql" -v skip=1 >/dev/null 2>&1 || true
$P -d hub -t -f "$ROOT/tests/sql/rls_test.sql"
