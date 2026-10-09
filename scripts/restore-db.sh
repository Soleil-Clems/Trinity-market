#!/usr/bin/env bash
# Chemin : scripts/restore-db.sh
# Restaure une sauvegarde : ./scripts/restore-db.sh /var/backups/app/db-XXXX.dump
# ⚠ Remplace le contenu actuel de la base. Le backend est arrêté pendant l'opération.
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP="${1:?usage: restore-db.sh <fichier.dump>}"
COMPOSE="docker compose -f docker-compose.prod.yml"

[ -f "$DUMP.sha256" ] && sha256sum -c "$DUMP.sha256"

read -r -p "Restaurer $DUMP et ÉCRASER la base actuelle ? (oui/non) " ok
[ "$ok" = "oui" ] || exit 1

$COMPOSE stop backend reverse-proxy
$COMPOSE exec -T database sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < "$DUMP"
$COMPOSE up -d
echo "Restauration terminée."