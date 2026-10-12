#!/bin/sh
# Chemin : server/docker/migrate.sh
# Exécute les migrations (service one-shot `migrate`, dev et prod).
# Ordre : MIGRATION_COMMAND si défini → Prisma → TypeORM → rien.
set -eu
cd /app

if [ -n "${MIGRATION_COMMAND:-}" ]; then
  echo "migrate: commande personnalisée : $MIGRATION_COMMAND"
  exec sh -c "$MIGRATION_COMMAND"
fi

if [ -d prisma ] || ls prisma.config.* >/dev/null 2>&1; then
  if [ ! -f node_modules/prisma/build/index.js ]; then
    echo "migrate: projet Prisma détecté mais la CLI 'prisma' est absente de l'image." >&2
    echo "         Déplacer 'prisma' de devDependencies vers dependencies (server/package.json)." >&2
    exit 1
  fi
  echo "migrate: prisma migrate deploy"
  exec node node_modules/prisma/build/index.js migrate deploy
fi

if [ -f node_modules/typeorm/cli.js ] && [ -f dist/database/data-source.js ]; then
  echo "migrate: typeorm migration:run"
  exec node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
fi

echo "migrate: aucun outil de migration détecté (Prisma / TypeORM) — rien à faire."