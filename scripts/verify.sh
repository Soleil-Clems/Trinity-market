#!/usr/bin/env bash
# Chemin : scripts/verify.sh
# Vérifie les critères d'acceptation en DEV (.docker/docker-compose.yml).
# S'arrête dès qu'une étape bloquante échoue (build, démarrage) : la suite n'aurait aucun sens.
set -uo pipefail
cd "$(dirname "$0")/.."
ok()   { echo "  ✅ $*"; }
ko()   { echo "  ❌ $*"; FAIL=1; }
stop() { echo; echo "⛔ $* — arrêt (les tests suivants dépendent de cette étape)."; exit 1; }
FAIL=0
PORT=${PUBLIC_PORT:-8080}
IMAGES=(app-backend:local app-frontend:local app-proxy:local)
compose() { docker compose --project-directory . -f .docker/docker-compose.yml "$@"; }
running() { [ -n "$(compose ps -q --status running "$1" 2>/dev/null)" ]; }

docker info >/dev/null 2>&1 || stop "Docker n'est pas démarré"

echo "1) Build"
compose build || stop "build en échec (voir l'erreur ci-dessus)"
for i in "${IMAGES[@]}"; do
  docker image inspect "$i" >/dev/null 2>&1 && ok "$i construite" || stop "$i absente"
done

echo "2) Taille des images"
for spec in "app-backend:local 250" "app-frontend:local 50"; do
  set -- $spec
  size=$(( $(docker image inspect "$1" --format '{{.Size}}') / 1000000 ))
  [ "$size" -le "$2" ] && ok "$1 : ${size} Mo (< $2)" || ko "$1 : ${size} Mo (> $2)"
done

echo "3) Aucun .env dans les images"
for img in "${IMAGES[@]}"; do
  if ! found=$(docker run --rm --entrypoint sh "$img" -c \
      "find / -xdev -name '.env*' -not -path '*/node_modules/*' 2>/dev/null; exit 0"); then
    ko "$img : impossible d'inspecter l'image"
  elif [ -z "$found" ]; then ok "$img"
  else ko "$img contient : $found"; fi
done

echo "4) Démarrage"
compose up -d --wait || { compose ps -a; compose logs --tail=30 migrate backend; stop "stack non healthy"; }
ok "tous les services sont healthy"
[ "$(docker inspect -f '{{.State.ExitCode}}' "$(compose ps -aq migrate)")" = "0" ] \
  && ok "migrations appliquées (migrate exit 0)" || ko "migrate en échec"

echo "5) Un seul port publié"
proxy_pub=$(compose ps --format json reverse-proxy | grep -c '"PublishedPort":[1-9]' || true)
others=$(compose ps --format json | grep -v '"Service":"reverse-proxy"' | grep -c '"PublishedPort":[1-9]' || true)
[ "$proxy_pub" -ge 1 ] && ok "reverse-proxy publie le port $PORT" || ko "reverse-proxy ne publie aucun port"
[ "$others" -eq 0 ] && ok "aucun autre service ne publie de port" || ko "$others autre(s) service(s) publient un port"

echo "6) En-têtes / compression / routage"
./scripts/check-headers.sh "http://localhost:$PORT" && ok "check-headers" || ko "check-headers"

echo "7) Isolation de la base"
running backend && compose exec -T backend sh -c "nc -z -w 3 database 5432" \
  && ok "contrôle positif : backend atteint database" || ko "backend n'atteint pas database (test non probant)"
for svc in frontend reverse-proxy; do
  if ! running "$svc"; then ko "$svc n'est pas démarré (test non probant)"; continue; fi
  compose exec -T "$svc" sh -c "nc -z -w 3 database 5432" 2>/dev/null \
    && ko "$svc atteint database" || ok "$svc ne voit pas database"
done

echo "8) Persistance"
running database || stop "database n'est pas démarrée"
compose exec -T database sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qc "CREATE TABLE IF NOT EXISTS _persist(v text); INSERT INTO _persist VALUES ('"'"'ok'"'"');"'
compose down && compose up -d --wait || stop "redémarrage impossible"
v=$(compose exec -T database sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT v FROM _persist LIMIT 1; DROP TABLE _persist;"' | head -1)
[ "$v" = "ok" ] && ok "données conservées" || ko "données perdues"

echo
[ "$FAIL" -eq 0 ] && echo "Tous les critères DEV sont validés." || { echo "Des critères échouent."; exit 1; }