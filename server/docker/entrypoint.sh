#!/bin/sh
# Chemin : server/docker/entrypoint.sh
# Point d'entrée du backend.
# 1. Docker secrets : pour chaque variable FOO_FILE=/run/secrets/x,
#    exporte FOO=<contenu du fichier> (le secret n'est jamais dans l'image
#    ni dans `docker inspect`).
# 2. Construit DATABASE_URL à partir de DB_* si elle n'est pas fournie.
set -eu

for entry in $(env | grep -oE '^[A-Z0-9_]+_FILE=' | tr -d '='); do
  var="${entry%_FILE}"
  file="$(printenv "$entry")"
  if [ ! -r "$file" ]; then
    echo "entrypoint: secret '$file' illisible pour $var" >&2
    exit 1
  fi
  export "$var=$(cat "$file")"
  unset "$entry"
done

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
  # DB_PASSWORD doit être URL-safe (scripts/gen-secrets.sh génère de l'hexadécimal)
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?schema=public"
fi

exec "$@"