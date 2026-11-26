#!/usr/bin/env bash
# Restore a backup into a target database. Refuses to overwrite a non-empty database unless FORCE=1.
# Usage: TARGET_DATABASE_URL=postgresql://.../properbysel_restore ./restore.sh backups/properbysel-<stamp>.dump
set -euo pipefail
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (the database to restore INTO)}"
FILE="${1:?Pass the .dump file}"
if [[ -f "$FILE.sha256" ]]; then sha256sum --check --status "$FILE.sha256" || { echo "Checksum mismatch for $FILE" >&2; exit 1; }; fi
TABLES="$(psql "$TARGET_DATABASE_URL" -tAc "select count(*) from pg_tables where schemaname='public'")"
if [[ "$TABLES" != "0" && "${FORCE:-0}" != "1" ]]; then
  echo "Target database already has $TABLES tables. Restore into an empty database, or set FORCE=1 after taking a fresh backup." >&2
  exit 1
fi
pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error --dbname="$TARGET_DATABASE_URL" "$FILE"
echo "Restored $FILE into target database."
