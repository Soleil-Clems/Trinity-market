#!/usr/bin/env bash
# Chemin : scripts/backup-db.sh
# Sauvegarde logique PostgreSQL (pg_dump format custom, compressé) avec rotation.
# Cron conseillé (tous les jours à 3h) :
#   0 3 * * * cd /opt/app && ./scripts/backup-db.sh >> /var/log/app-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/app}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/db-$STAMP.dump"

umask 077
mkdir -p "$BACKUP_DIR"

$COMPOSE exec -T database sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9 --no-owner' \
  > "$FILE.partial"
mv "$FILE.partial" "$FILE"

# Vérifie que l'archive est lisible (sinon échec → alerte via cron/monitoring)
$COMPOSE exec -T database pg_restore --list < "$FILE" > /dev/null
sha256sum "$FILE" > "$FILE.sha256"

find "$BACKUP_DIR" -name 'db-*.dump*' -mtime +"$RETENTION" -delete
echo "$(date -u +%FT%TZ) sauvegarde OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Copie hors site (règle 3-2-1) — exemple avec rclone vers un stockage objet :
# rclone copy "$FILE" remote:app-backups/ && rclone copy "$FILE.sha256" remote:app-backups/