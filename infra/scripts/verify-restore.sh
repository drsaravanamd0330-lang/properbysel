#!/usr/bin/env bash
# Backup drill: dump the source DB, restore into a scratch DB, and compare row counts of every table.
# Usage: DATABASE_URL=postgresql://.../properbysel ADMIN_URL=postgresql://.../postgres ./verify-restore.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL (source)}"
: "${ADMIN_URL:?Set ADMIN_URL (a connection that may CREATE/DROP DATABASE, e.g. .../postgres)}"
SCRATCH="pbs_restore_drill_$(date +%s)"
TMP="$(mktemp -d)"
trap 'psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/backup.sh" "$TMP" >/dev/null
DUMP="$(ls "$TMP"/*.dump)"
psql "$ADMIN_URL" -qc "CREATE DATABASE $SCRATCH"
TARGET="${ADMIN_URL%/*}/$SCRATCH"
TARGET_DATABASE_URL="$TARGET" "$DIR/restore.sh" "$DUMP" >/dev/null
count_all() { psql "$1" -tAc "select string_agg(t || '=' || n, ' ' order by t) from (select tablename t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', tablename), false, true, '')))[1]::text::int n from pg_tables where schemaname='public') s"; }
SRC="$(count_all "$DATABASE_URL")"; DST="$(count_all "$TARGET")"
if [[ "$SRC" == "$DST" ]]; then
  echo "RESTORE DRILL PASSED: $(echo "$SRC" | wc -w) tables, row counts identical."
  echo "$SRC" | tr ' ' '\n' | grep -E '^(Listing|User|Order|Enquiry|Message|AuditLog)=' | sed 's/^/  /'
else
  echo "RESTORE DRILL FAILED"; echo "source: $SRC"; echo "restored: $DST"; exit 1
fi
