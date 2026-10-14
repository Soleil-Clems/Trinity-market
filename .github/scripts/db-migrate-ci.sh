#!/usr/bin/env bash
# Chemin : .github/scripts/db-migrate-ci.sh
# Prépare la base de test du job test-backend (Prisma ou TypeORM).
set -euo pipefail
if [ -f prisma/schema.prisma ] || ls prisma.config.* >/dev/null 2>&1; then
  echo "::group::Prisma — generate + migrate deploy"
  npx --no-install prisma generate
  npx --no-install prisma migrate deploy
  echo "::endgroup::"
elif node -e "process.exit(require('./package.json').scripts?.['migration:run']?0:1)"; then
  echo "::group::npm run migration:run"
  npm run migration:run
  echo "::endgroup::"
else
  echo "::notice title=Migrations::Aucun outil de migration détecté : base de test laissée vide."
fi