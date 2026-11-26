#!/usr/bin/env bash
# Logical backup of the ProperBySel database in PostgreSQL custom format.
# Usage: DATABASE_URL=postgresql://... ./backup.sh [output-dir]
# Uploaded media lives in object storage and needs its own versioning/replication (see docs/RUNBOOKS.md).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/properbysel-$STAMP.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$DATABASE_URL"
sha256sum "$FILE" > "$FILE.sha256"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
