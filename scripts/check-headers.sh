#!/usr/bin/env bash
# Chemin : scripts/check-headers.sh
# Vérifie en-têtes de sécurité, compression et cache.
# Usage : ./scripts/check-headers.sh https://app.example.com   (ou http://localhost:8080)
set -uo pipefail
URL="${1:-http://localhost:8080}"
FAIL=0
H=$(curl -ksSI "$URL/")

check() { echo "$H" | grep -qi "^$1:" && echo "  ✅ $1" || { echo "  ❌ $1 absent"; FAIL=1; }; }

echo "En-têtes sur $URL/"
for h in Content-Security-Policy X-Content-Type-Options X-Frame-Options Referrer-Policy Permissions-Policy; do
  check "$h"
done
if [[ "$URL" == https://* ]]; then check Strict-Transport-Security; else echo "  ➖ HSTS non attendu en HTTP (dev)"; fi

echo "Compression"
enc=$(curl -ksS -o /dev/null -D - -H 'Accept-Encoding: br' "$URL/" | grep -i '^content-encoding' | tr -d '\r')
[ -n "$enc" ] && echo "  ✅ $enc" || { echo "  ❌ pas de compression"; FAIL=1; }

echo "API via le même port"
curl -ksf "$URL/api/health" > /dev/null && echo "  ✅ /api/health" || { echo "  ❌ /api/health"; FAIL=1; }

exit $FAIL